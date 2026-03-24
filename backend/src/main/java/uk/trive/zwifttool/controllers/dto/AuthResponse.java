package uk.trive.zwifttool.controllers.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Response body returned after successful sign-up or sign-in.
 *
 * <p>Contains only non-sensitive user information. Tokens are set in
 * HttpOnly cookies, not in the response body.</p>
 */
@Data
@Builder
public class AuthResponse {

    private String userId;
    private String email;
    private String displayName;
}