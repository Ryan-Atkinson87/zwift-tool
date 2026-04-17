package uk.trive.zwifttool.models;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a saved workout, linking to its three section blocks.
 * Warm-up and cool-down are optional; main set is mandatory.
 *
 * <p>The {@code prev_} block columns store the previous section blocks
 * to support single-step undo after a bulk replacement.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "workouts")
public class Workout {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String author;

    private String description;

    @ManyToOne
    @JoinColumn(name = "warmup_block_id")
    private Block warmupBlock;

    @ManyToOne
    @JoinColumn(name = "mainset_block_id", nullable = false)
    private Block mainsetBlock;

    @ManyToOne
    @JoinColumn(name = "cooldown_block_id")
    private Block cooldownBlock;

    @ManyToOne
    @JoinColumn(name = "prev_warmup_block_id")
    private Block prevWarmupBlock;

    @ManyToOne
    @JoinColumn(name = "prev_mainset_block_id")
    private Block prevMainsetBlock;

    @ManyToOne
    @JoinColumn(name = "prev_cooldown_block_id")
    private Block prevCooldownBlock;

    @Column(name = "is_draft", nullable = false)
    private boolean isDraft;

    /**
     * Raw XML fragment for the {@code <tags>} block from the original .zwo file,
     * preserved verbatim so it can be round-tripped on export. Null if the
     * source file contained no {@code <tags>} element.
     *
     * <p>Example value: {@code <tags>\n    <tag name="SST"/>\n</tags>}</p>
     */
    @Column(name = "tags", columnDefinition = "text")
    private String tags;

    /**
     * JSON array of text events displayed over the workout timeline.
     * Stored as a JSON string in a {@code jsonb} column so we can add,
     * edit, and delete entries without a schema migration per event type.
     * Null or empty means "no text events".
     */
    @Column(name = "text_events", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String textEvents;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // Keep the in-memory entity consistent with the database trigger so
    // update responses reflect the actual save time, not the pre-save value.
    @PreUpdate
    private void onUpdate() {
        updatedAt = Instant.now();
    }
}
