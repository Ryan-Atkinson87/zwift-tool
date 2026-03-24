package uk.trive.zwifttool;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import uk.trive.zwifttool.repositories.UserIdentityRepository;
import uk.trive.zwifttool.repositories.UserRepository;
import uk.trive.zwifttool.repositories.UserSessionRepository;

/**
 * Smoke tests that verify the Spring application context loads without errors.
 *
 * <p>Repository beans are mocked because the test configuration excludes
 * the database to allow unit tests to run without a database connection.</p>
 */
@SpringBootTest
class ZwiftToolApplicationTests {

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserIdentityRepository userIdentityRepository;

    @MockitoBean
    private UserSessionRepository userSessionRepository;

    @Test
    void contextLoads() {
    }
}