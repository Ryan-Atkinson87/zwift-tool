package uk.trive.zwifttool.controllers.dto;

import lombok.Data;

/**
 * Request body for the sign-in endpoint.
 */
@Data
public class SignInRequest {

    private String email;
    private String password;
}