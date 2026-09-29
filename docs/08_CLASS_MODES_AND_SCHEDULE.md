# Class Modes and Imported Schedule

## Class mode
A class has exactly one `delivery_mode`: `offline` or `online`. The value belongs to `public.classes`, so all schedules inherit the class mode by default.

## Schedule fields
`subjects` stores academic identity from the supplied timetable:
- `name`
- `code`
- `lecturer_code`
- `lecturer_code_secondary`
- `credits`
- `practical_group`

`schedules` stores the weekly meeting:
- `day_of_week`
- `starts_at`
- `ends_at`
- `room`
- `location`
- `meeting_url`

## Template import
Class Admin may run `public.apply_schedule_template(class_id)`. The function validates admin access server-side, upserts the 8 timetable rows, and returns the number of template rows processed.

## Source
The timetable was manually transcribed from `docs/assets/jadwal-matakuliah-sumber.png`. Where the image contains no value, the field remains null.
