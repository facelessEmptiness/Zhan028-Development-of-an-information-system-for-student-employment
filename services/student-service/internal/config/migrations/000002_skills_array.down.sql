ALTER TABLE students
    ALTER COLUMN skills TYPE text
    USING array_to_string(skills, ',');
