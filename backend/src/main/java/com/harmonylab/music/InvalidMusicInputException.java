package com.harmonylab.music;

/**
 * Thrown when musical input cannot be interpreted (bad note names, unsupported chord symbols,
 * impossible voicings, ...). The message is intended to be shown to the user.
 */
public class InvalidMusicInputException extends RuntimeException {

    public InvalidMusicInputException(String message) {
        super(message);
    }
}
