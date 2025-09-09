-- Update character URLs to use the imported images
UPDATE public.character_sheets SET 
  cartoon_reference_url = CASE name
    WHEN 'Whiskers the Cat' THEN 'cat-1'
    WHEN 'Buddy the Dog' THEN 'dog-1'
    WHEN 'Hoppy the Rabbit' THEN 'rabbit-1'
    WHEN 'Bruno the Bear' THEN 'bear-1'
    WHEN 'Ellie the Elephant' THEN 'elephant-1'
    WHEN 'Leo the Lion' THEN 'lion-1'
    WHEN 'Foxy the Fox' THEN 'fox-1'
    WHEN 'Panda Po' THEN 'panda-1'
    ELSE cartoon_reference_url
  END
WHERE name IN ('Whiskers the Cat', 'Buddy the Dog', 'Hoppy the Rabbit', 'Bruno the Bear', 'Ellie the Elephant', 'Leo the Lion', 'Foxy the Fox', 'Panda Po');