package uk.trive.zwifttool.models;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single user's customised default for a Zwift training zone.
 *
 * <p>A row is only written when the user deviates from the system default
 * for that zone. Resetting a zone to its default deletes the row. The
 * absence of a row therefore implies the system default applies.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "zone_presets")
public class ZonePreset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    /** Zwift training zone, 1 to 5. */
    @Column(nullable = false)
    private Integer zone;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds;

    @Column(name = "ftp_percent", nullable = false)
    private Integer ftpPercent;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
