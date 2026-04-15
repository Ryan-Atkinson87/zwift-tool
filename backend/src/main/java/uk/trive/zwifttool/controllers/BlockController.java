package uk.trive.zwifttool.controllers;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.BlockResponse;
import uk.trive.zwifttool.controllers.dto.SaveBlockRequest;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.services.BlockService;

/**
 * Handles block library endpoints: saving sections to the library and
 * retrieving the user's saved blocks.
 *
 * <p>All endpoints require a valid access token. The user ID is extracted
 * from the JWT by Spring Security.</p>
 */
@Slf4j
@RestController
@RequestMapping("/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;

    /**
     * Saves a workout section as a library block for the authenticated user.
     *
     * @param request the block data including name, description, section type, and content
     * @param userId  the authenticated user's ID, resolved from the JWT
     * @return HTTP 201 with the saved block
     */
    @PostMapping
    public ResponseEntity<BlockResponse> saveBlock(
            @Valid @RequestBody SaveBlockRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        Block block = blockService.saveLibraryBlock(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(block));
    }

    /**
     * Returns library blocks belonging to the authenticated user, optionally
     * filtered to a single section type, ordered by creation date descending.
     *
     * <p>When {@code sectionType} is omitted, all library blocks are returned.
     * An invalid {@code sectionType} value results in HTTP 400.</p>
     *
     * @param sectionType optional section type filter (WARMUP, MAINSET, or COOLDOWN)
     * @param userId      the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the block list, or HTTP 204 if no matching blocks exist
     */
    @GetMapping
    public ResponseEntity<List<BlockResponse>> getLibraryBlocks(
            @RequestParam(required = false) SectionType sectionType,
            @AuthenticationPrincipal UUID userId
    ) {
        List<BlockResponse> blocks = blockService.getLibraryBlocks(userId, Optional.ofNullable(sectionType))
                .stream()
                .map(this::toResponse)
                .toList();

        return blocks.isEmpty()
                ? ResponseEntity.noContent().build()
                : ResponseEntity.ok(blocks);
    }

    /**
     * Updates a library block owned by the authenticated user. Replaces the
     * name, description, section type, and interval content with the values
     * supplied in the request body.
     *
     * @param blockId the ID of the block to update
     * @param request the updated block data
     * @param userId  the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the updated block
     */
    @PutMapping("/{blockId}")
    public ResponseEntity<BlockResponse> updateBlock(
            @PathVariable UUID blockId,
            @Valid @RequestBody SaveBlockRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        Block block = blockService.updateLibraryBlock(blockId, request, userId);
        return ResponseEntity.ok(toResponse(block));
    }

    /**
     * Deletes a library block owned by the authenticated user.
     *
     * <p>If the block is still referenced by a workout, it is soft-deleted
     * (removed from the library without affecting the workout). If not
     * referenced, it is removed from the database entirely.</p>
     *
     * @param blockId the ID of the block to delete
     * @param userId  the authenticated user's ID, resolved from the JWT
     * @return HTTP 204 No Content on success
     */
    @DeleteMapping("/{blockId}")
    public ResponseEntity<Void> deleteBlock(
            @PathVariable UUID blockId,
            @AuthenticationPrincipal UUID userId
    ) {
        blockService.deleteLibraryBlock(blockId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Maps a Block entity to its API response representation.
     */
    private BlockResponse toResponse(Block block) {
        return BlockResponse.builder()
                .id(block.getId())
                .name(block.getName())
                .description(block.getDescription())
                .sectionType(block.getSectionType())
                .content(block.getContent())
                .durationSeconds(block.getDurationSeconds())
                .intervalCount(block.getIntervalCount())
                .isLibraryBlock(block.isLibraryBlock())
                .build();
    }
}
