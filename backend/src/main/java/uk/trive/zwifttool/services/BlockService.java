package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveBlockRequest;
import uk.trive.zwifttool.models.Block;
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
     * Returns all library blocks owned by the given user, ordered by most
     * recently created first.
     *
     * @param userId the authenticated user's ID
     * @return list of library blocks, empty if the user has none
     */
    public List<Block> getLibraryBlocks(UUID userId) {
        log.debug("Fetching library blocks for user {}", userId);
        return blockRepository.findByUserIdAndIsLibraryBlockTrueOrderByCreatedAtDesc(userId);
    }
}
