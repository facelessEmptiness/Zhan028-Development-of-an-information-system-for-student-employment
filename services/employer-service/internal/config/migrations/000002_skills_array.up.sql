ALTER TABLE vacancies
    ALTER COLUMN skills TYPE text[]
    USING CASE
        WHEN skills IS NULL OR trim(skills) = '' THEN ARRAY[]::text[]
        ELSE string_to_array(trim(skills), ',')
    END;
