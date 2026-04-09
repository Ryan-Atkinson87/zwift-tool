package uk.trive.zwifttool.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.ZonePresetRequest;
import uk.trive.zwifttool.controllers.dto.ZonePresetResponse;
import uk.trive.zwifttool.services.ZonePresetService;

/**
 * Endpoints for reading and customising zone preset defaults.
 *
 * <p>All endpoints require authentication. The responses always cover the
 * full set of five zones so the frontend can render the settings panel
 * without a separate "defaults" call.</p>
 */
@Slf4j
@RestController
@RequestMapping("/zone-presets")
@RequiredArgsConstructor
public class ZonePresetController {

    private final ZonePresetService zonePresetService;

    /**
     * Returns the effective preset for every zone, with user customisations
     * overlaid on the system defaults.
     *
     * @param userId the authenticated user's ID
     * @return HTTP 200 with a list of five zone preset responses
     */
    @GetMapping
    public ResponseEntity<List<ZonePresetResponse>> getPresets(
            @AuthenticationPrincipal UUID userId
    ) {
        return ResponseEntity.ok(zonePresetService.getEffectivePresets(userId));
    }

    /**
     * Upserts the preset for a single zone. If the supplied values match
     * the system default the custom row is removed, matching the
     * "absence implies default" invariant.
     *
     * @param zone    the zone number in the URL path, 1 to 5
     * @param request the new duration and %FTP values
     * @param userId  the authenticated user's ID
     * @return HTTP 200 with the effective preset after the write
     */
    @PutMapping("/{zone}")
    public ResponseEntity<ZonePresetResponse> upsertPreset(
            @PathVariable Integer zone,
            @Valid @RequestBody ZonePresetRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        ZonePresetResponse response = zonePresetService.upsertPreset(
                userId,
                zone,
                request.getDurationSeconds(),
                request.getFtpPercent()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Resets the preset for a single zone by deleting any custom row.
     *
     * @param zone   the zone number in the URL path, 1 to 5
     * @param userId the authenticated user's ID
     * @return HTTP 200 with the system default for the zone
     */
    @DeleteMapping("/{zone}")
    public ResponseEntity<ZonePresetResponse> deletePreset(
            @PathVariable Integer zone,
            @AuthenticationPrincipal UUID userId
    ) {
        return ResponseEntity.ok(zonePresetService.deletePreset(userId, zone));
    }
}
