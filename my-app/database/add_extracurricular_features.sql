-- Add Extracurricular / Outdoor / PE Features for room tagging
-- Run this SQL in your Supabase SQL Editor

INSERT INTO public.feature_tags (tag_name, tag_category, description, icon) VALUES
-- Extracurricular / Outdoor / PE
('Outdoor_Field', 'extracurricular', 'Outdoor field or court area', 'sun'),
('Gymnasium', 'extracurricular', 'Indoor gymnasium/sports hall', 'dumbbell'),
('Swimming_Pool', 'extracurricular', 'Swimming pool facility', 'waves'),
('Dance_Studio', 'extracurricular', 'Dance or aerobics studio with mirrors', 'music'),
('Fitness_Equipment', 'extracurricular', 'Exercise machines and weights', 'dumbbell'),
('Sports_Court', 'extracurricular', 'Basketball/Volleyball/Tennis court', 'circle'),
('Track_Field', 'extracurricular', 'Running track and field events area', 'flag'),
('Covered_Court', 'extracurricular', 'Covered outdoor court', 'home'),
('Open_Area', 'extracurricular', 'Open space for outdoor activities', 'maximize'),
('Stage_Area', 'extracurricular', 'Stage or performance area', 'video')
ON CONFLICT (tag_name) DO NOTHING;

-- Verify the new tags
SELECT * FROM public.feature_tags WHERE tag_category = 'extracurricular' ORDER BY tag_name;
