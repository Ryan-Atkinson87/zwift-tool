package uk.trive.zwifttool.controllers.dto;

import java.time.Instant;
import java.util.UUID;

import lombok.Builder;
import lombok.Data;

/**
 * Response body representing a saved workout.
 * Includes the workout metadata and IDs of each section block.
 */
@Data
@Builder
public class WorkoutResponse {

    private UUID id;
    private String name;
    private String author;
    private String description;
    private UUID warmupBlockId;
    private UUID mainsetBlockId;
    private UUID cooldownBlockId;
    private boolean isDraft;
    private Instant createdAt;
    private Instant updatedAt;
}
