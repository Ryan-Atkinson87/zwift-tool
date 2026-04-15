package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for the sign-in endpoint.
 *
 * <p>Validation is enforced by Jakarta Bean Validation annotations and
 * triggered by {@code @Valid} on the controller parameter.</p>
 */
@Data
public class SignInRequest {

    @NotBlank(message = "Email is required.")
    private String email;

    @NotBlank(message = "Password is required.")
    private String password;
}