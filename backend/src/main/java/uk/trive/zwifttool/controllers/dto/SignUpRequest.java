package uk.trive.zwifttool.controllers.dto;

import lombok.Data;

/**
 * Request body for the sign-up endpoint.
 */
@Data
public class SignUpRequest {

    private String email;
    private String password;
    private String displayName;
}