ALTER TABLE vacancies
    ALTER COLUMN skills TYPE text
    USING array_to_string(skills, ',');
