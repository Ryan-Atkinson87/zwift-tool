package uk.trive.zwifttool.controllers.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Response payload representing the effective defaults for a single zone.
 *
 * <p>{@code isCustom} is {@code true} when the row came from a user
 * override, and {@code false} when the values are falling back to the
 * system default. The frontend uses this to render a "reset" affordance
 * only on customised rows.</p>
 */
@Data
@Builder
@AllArgsConstructor
public class ZonePresetResponse {

    private Integer zone;
    private Integer durationSeconds;
    private Integer ftpPercent;
    private boolean isCustom;
}
