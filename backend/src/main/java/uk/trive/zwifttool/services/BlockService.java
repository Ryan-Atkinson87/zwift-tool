package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveBlockRequest;
import uk.trive.zwifttool.exceptions.BlockNotFoundException;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.repositories.BlockRepository;

/**
 * Handles business logic for block library operations, including saving
 * sections to the library and retrieving a user's saved blocks.
 *
 * <p>All methods assume the caller has already verified authentication.
 * The user ID is passed in from the controller.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;

    /**
     * Saves a workout section as a library block owned by the given user.
     * The block is always created with {@code is_library_block = true}.
     *
     * @param request the block data including name, description, section type, content,
     *                duration, and interval count
     * @param userId  the authenticated user's ID
     * @return the saved block record
     */
    public Block saveLibraryBlock(SaveBlockRequest request, UUID userId) {
        log.info("Saving library block '{}' ({}) for user {}", request.getName(), request.getSectionType(), userId);

        Block block = Block.builder()
                .userId(userId)
                .name(request.getName())
                .description(request.getDescription())
                .sectionType(request.getSectionType())
                .content(request.getContent())
                .durationSeconds(request.getDurationSeconds())
                .intervalCount(request.getIntervalCount())
                .isLibraryBlock(true)
                .createdAt(Instant.now())
                .build();

        return blockRepository.save(block);
    }

    /**
     * Returns library blocks owned by the given user, optionally filtered to
     * a single section type, ordered by most recently created first.
     *
     * <p>When {@code sectionType} is empty, all library blocks are returned
     * regardless of section type.</p>
     *
     * @param userId      the authenticated user's ID
     * @param sectionType an optional section type to filter by
     * @return list of matching library blocks, empty if the user has none
     */
    public List<Block> getLibraryBlocks(UUID userId, Optional<SectionType> sectionType) {
        log.debug("Fetching library blocks for user {} (sectionType={})", userId, sectionType.orElse(null));
        return sectionType
                .map(type -> blockRepository.findByUserIdAndIsLibraryBlockTrueAndSectionTypeOrderByCreatedAtDesc(userId, type))
                .orElseGet(() -> blockRepository.findByUserIdAndIsLibraryBlockTrueOrderByCreatedAtDesc(userId));
    }

    /**
     * Deletes a library block owned by the given user.
     *
     * <p>If the block is still referenced by any workout (in any current or
     * previous section column), it is soft-deleted by setting
     * {@code is_library_block = false} so the block no longer appears in the
     * library but the workout data remains intact. If the block is not
     * referenced by any workout, it is hard-deleted from the database.</p>
     *
     * @param blockId the ID of the block to delete
     * @param userId  the authenticated user's ID, used for ownership verification
     * @throws BlockNotFoundException if no block exists with the given ID for this user
     */
    public void deleteLibraryBlock(UUID blockId, UUID userId) {
        Block block = blockRepository.findById(blockId)
                .filter(b -> b.getUserId().equals(userId))
                .orElseThrow(() -> new BlockNotFoundException(blockId));

        log.info("Deleting library block '{}' ({}) for user {}", block.getName(), blockId, userId);

        if (blockRepository.isReferencedByAnyWorkout(blockId)) {
            // Block is still referenced by at least one workout: soft-delete by
            // removing it from the library without breaking the workout data.
            block.setLibraryBlock(false);
            blockRepository.save(block);
            log.debug("Block {} is referenced by a workout: soft-deleted (is_library_block = false)", blockId);
        } else {
            blockRepository.delete(block);
            log.debug("Block {} has no workout references: hard-deleted", blockId);
        }
    }
}
