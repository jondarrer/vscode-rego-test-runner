# Development

## Variable naming

### package

E.g. `passed.all_passed_1_test` (version used to define a package)

E.g. `data.passed.all_passed_1_test` (version beginning with `data`, used to refer to a package)

### testName

E.g. `test_post_allowed` (a policy beginning with `test_`)

E.g. `todo_test_post_allowed` (for todo tests - a policy beginning with `todo_test_`).

### testId

The nearly unique name of a test. Duplicate tests share the same name when defined, but a different name when referred to.

`package` (version beginning with `data`), plus `testName`.

E.g. `data.passed.all_passed_1_test.test_post_allowed`

E.g. `data.passed.all_passed_1_test.test_post_allowed#01` (when referring to a duplicate test)

### testRqn (relative qualified name)

The completely unique name of a test. Relative path to test, plus `testId`.

E.g. `sample/policies/passed#data.passed.all_passed_1_test.test_post_allowed`