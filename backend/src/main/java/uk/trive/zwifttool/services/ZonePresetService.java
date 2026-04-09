package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.ZonePresetResponse;
import uk.trive.zwifttool.exceptions.InvalidZoneFtpException;
import uk.trive.zwifttool.models.ZonePreset;
import uk.trive.zwifttool.repositories.ZonePresetRepository;

/**
 * Business logic for reading and customising zone preset defaults.
 *
 * <p>A row is only written to {@code zone_presets} when the user's values
 * differ from the system defaults. Resetting a zone to its default deletes
 * the row, so the absence of a row always implies the system default
 * applies. This keeps the table sparse and avoids drift when we later tune
 * the documented defaults.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZonePresetService {

    private final ZonePresetRepository zonePresetRepository;

    /**
     * Immutable description of a single Zwift training zone's system
     * default and valid %FTP band. The upper bound on Zone 5 is treated as
     * an inclusive cap matching the documented preset range.
     */
    private record SystemDefault(
            int zone,
            int durationSeconds,
            int ftpPercent,
            int minFtpPercent,
            int maxFtpPercent
    ) {}

    /**
     * Documented system defaults and valid bands, ordered Zone 1 through
     * Zone 5. Kept in sync with the frontend {@code ZONE_PRESETS} table and
     * the issue spec.
     */
    private static final Map<Integer, SystemDefault> SYSTEM_DEFAULTS = Map.of(
            1, new SystemDefault(1, 10 * 60, 50, 0, 59),
            2, new SystemDefault(2, 20 * 60, 68, 60, 75),
            3, new SystemDefault(3, 15 * 60, 83, 76, 90),
            4, new SystemDefault(4, 8 * 60, 98, 91, 105),
            5, new SystemDefault(5, 2 * 60, 113, 106, 120)
    );

    /**
     * Returns the effective preset for every zone, overlaying any custom
     * rows on top of the system defaults. Always returns exactly five
     * entries in zone order regardless of how many custom rows exist.
     *
     * @param userId the authenticated user's ID
     * @return list of effective presets, Zone 1 first
     */
    public List<ZonePresetResponse> getEffectivePresets(UUID userId) {
        List<ZonePreset> customRows = zonePresetRepository.findAllByUserId(userId);
        Map<Integer, ZonePreset> customByZone = new java.util.HashMap<>();
        for (ZonePreset row : customRows) {
            customByZone.put(row.getZone(), row);
        }

        List<ZonePresetResponse> result = new ArrayList<>(5);
        for (int zone = 1; zone <= 5; zone++) {
            SystemDefault defaults = SYSTEM_DEFAULTS.get(zone);
            ZonePreset custom = customByZone.get(zone);
            if (custom != null) {
                result.add(ZonePresetResponse.builder()
                        .zone(zone)
                        .durationSeconds(custom.getDurationSeconds())
                        .ftpPercent(custom.getFtpPercent())
                        .isCustom(true)
                        .build());
            } else {
                result.add(ZonePresetResponse.builder()
                        .zone(zone)
                        .durationSeconds(defaults.durationSeconds())
                        .ftpPercent(defaults.ftpPercent())
                        .isCustom(false)
                        .build());
            }
        }
        return result;
    }

    /**
     * Upserts the preset for a single zone. If the supplied values match
     * the system default, any existing row is deleted rather than updated
     * so the absence of a row always means "system default applies".
     *
     * @param userId          the authenticated user's ID
     * @param zone            the zone number, 1 to 5
     * @param durationSeconds the new default duration in seconds
     * @param ftpPercent      the new default %FTP for the zone
     * @return the effective preset after the write
     * @throws InvalidZoneFtpException if the zone or values are invalid
     */
    @Transactional
    public ZonePresetResponse upsertPreset(
            UUID userId,
            Integer zone,
            Integer durationSeconds,
            Integer ftpPercent
    ) {
        SystemDefault defaults = requireValidZone(zone);
        if (durationSeconds == null || durationSeconds < 1) {
            throw new InvalidZoneFtpException("Duration must be at least 1 second.");
        }
        if (ftpPercent == null
                || ftpPercent < defaults.minFtpPercent()
                || ftpPercent > defaults.maxFtpPercent()) {
            throw new InvalidZoneFtpException(
                    "Zone " + zone + " %FTP must be between "
                            + defaults.minFtpPercent() + " and "
                            + defaults.maxFtpPercent() + "."
            );
        }

        // Resetting to the documented default clears the custom row so the
        // table stays sparse and the user automatically picks up any future
        // change to the documented defaults.
        if (durationSeconds.intValue() == defaults.durationSeconds()
                && ftpPercent.intValue() == defaults.ftpPercent()) {
            zonePresetRepository.deleteByUserIdAndZone(userId, zone);
            log.info("Reset zone {} preset to default for user {}", zone, userId);
            return ZonePresetResponse.builder()
                    .zone(zone)
                    .durationSeconds(defaults.durationSeconds())
                    .ftpPercent(defaults.ftpPercent())
                    .isCustom(false)
                    .build();
        }

        Optional<ZonePreset> existing = zonePresetRepository.findByUserIdAndZone(userId, zone);
        ZonePreset row = existing.orElseGet(() -> ZonePreset.builder()
                .userId(userId)
                .zone(zone)
                .createdAt(Instant.now())
                .build());
        row.setDurationSeconds(durationSeconds);
        row.setFtpPercent(ftpPercent);
        zonePresetRepository.save(row);
        log.info("Saved custom zone {} preset for user {}", zone, userId);

        return ZonePresetResponse.builder()
                .zone(zone)
                .durationSeconds(durationSeconds)
                .ftpPercent(ftpPercent)
                .isCustom(true)
                .build();
    }

    /**
     * Removes any custom row for the given user and zone, restoring the
     * system default. Idempotent: calling against a zone that is already
     * on the system default is a no-op.
     *
     * @param userId the authenticated user's ID
     * @param zone   the zone number, 1 to 5
     * @return the effective preset after the reset (always a system default)
     * @throws InvalidZoneFtpException if the zone number is outside 1..5
     */
    @Transactional
    public ZonePresetResponse deletePreset(UUID userId, Integer zone) {
        SystemDefault defaults = requireValidZone(zone);
        zonePresetRepository.deleteByUserIdAndZone(userId, zone);
        log.info("Deleted custom zone {} preset for user {}", zone, userId);
        return ZonePresetResponse.builder()
                .zone(zone)
                .durationSeconds(defaults.durationSeconds())
                .ftpPercent(defaults.ftpPercent())
                .isCustom(false)
                .build();
    }

    /**
     * Validates that the supplied zone number is within the documented
     * 1 to 5 range and returns its system default descriptor.
     */
    private SystemDefault requireValidZone(Integer zone) {
        if (zone == null || zone < 1 || zone > 5) {
            throw new InvalidZoneFtpException("Zone must be between 1 and 5.");
        }
        return SYSTEM_DEFAULTS.get(zone);
    }
}
