package uk.trive.zwifttool.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.BlockResponse;
import uk.trive.zwifttool.controllers.dto.SaveBlockRequest;
import uk.trive.zwifttool.models.Block;
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
     * Returns all library blocks belonging to the authenticated user,
     * ordered by creation date descending.
     *
     * @param userId the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the block list, or HTTP 204 if the user has no library blocks
     */
    @GetMapping
    public ResponseEntity<List<BlockResponse>> getLibraryBlocks(
            @AuthenticationPrincipal UUID userId
    ) {
        List<BlockResponse> blocks = blockService.getLibraryBlocks(userId)
                .stream()
                .map(this::toResponse)
                .toList();

        return blocks.isEmpty()
                ? ResponseEntity.noContent().build()
                : ResponseEntity.ok(blocks);
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
