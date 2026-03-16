package uk.trive.zwifttool;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Zwift Tool Spring Boot application.
 */
@SpringBootApplication
public class ZwiftToolApplication {

    /**
     * Starts the Spring Boot application.
     *
     * @param args command-line arguments passed to the application
     */
    public static void main(String[] args) {
        SpringApplication.run(ZwiftToolApplication.class, args);
    }
}