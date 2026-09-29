# RLS TEST PLAN

Run this test plan against a non-production Supabase project.

## Test identities

Create:
- USER_A
- USER_B
- USER_C

Create:
- CLASS_A created by USER_A
- CLASS_B created by USER_C

Membership:
- USER_A admin CLASS_A
- USER_B member CLASS_A
- USER_C admin CLASS_B

## Expected results

### Classes

USER_A can SELECT CLASS_A.
USER_B can SELECT CLASS_A.
USER_C can SELECT CLASS_B.
USER_A cannot SELECT CLASS_B.
USER_B cannot UPDATE CLASS_A.
USER_A can UPDATE CLASS_A.
USER_A cannot UPDATE CLASS_B.

### Members

USER_A and USER_B can read CLASS_A members.
USER_C cannot read CLASS_A members.
USER_A cannot manufacture membership for USER_B without admin/member policy.
Join uses `join_class_by_code`.

### Profile

USER_A can read/update own profile.
A member can read only profiles needed for shared class context.
USER_A cannot update USER_B profile.

### Personal notes

USER_A can CRUD own notes.
USER_B cannot read USER_A notes.
USER_B cannot update USER_A notes.

### Tasks/progress

USER_A can read CLASS_A tasks.
USER_B can read CLASS_A tasks.
USER_A can modify own progress.
USER_A cannot modify USER_B progress.
USER_B cannot read CLASS_B tasks.

### Storage

USER_A can read CLASS_A class-files path.
USER_B can read CLASS_A class-files path.
USER_C cannot read CLASS_A class-files path.
USER_A can upload to CLASS_A.
USER_A cannot write to CLASS_B.

### Poll

USER_B can vote once in CLASS_A poll.
Second vote is rejected by unique constraint.
Closed poll is rejected.

### Cash

USER_A admin can create transaction for CLASS_A.
USER_B cannot create transaction.
USER_B can read permitted class cash data.
USER_C cannot read CLASS_A cash data.

## Regression rule

Any RLS change requires rerunning all allow/deny tests for the affected table and all helper functions used by the policy.
