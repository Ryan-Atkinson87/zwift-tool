package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for the sign-up endpoint.
 *
 * <p>Validation is enforced by Jakarta Bean Validation annotations and
 * triggered by {@code @Valid} on the controller parameter.</p>
 */
@Data
public class SignUpRequest {

    @NotBlank(message = "Email is required.")
    @Email(message = "Please provide a valid email address.")
    private String email;

    @NotBlank(message = "Password is required.")
    @Size(min = 8, message = "Password must be at least 8 characters.")
    private String password;

    private String displayName;
}