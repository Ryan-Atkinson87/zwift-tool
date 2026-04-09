package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for upserting a zone preset customisation.
 *
 * <p>Range enforcement against the documented per-zone %FTP band is
 * performed in the service layer because the allowed range depends on the
 * zone path parameter, not the body alone.</p>
 */
@Data
public class ZonePresetRequest {

    /** Default duration in seconds to apply when the preset button is clicked. */
    @NotNull(message = "Duration is required.")
    @Min(value = 1, message = "Duration must be at least 1 second.")
    private Integer durationSeconds;

    /** Default %FTP to apply when the preset button is clicked. */
    @NotNull(message = "%FTP is required.")
    @Min(value = 0, message = "%FTP cannot be negative.")
    private Integer ftpPercent;
}
