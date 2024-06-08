package todo.all_todo_2_test

import rego.v1

todo_test_post_allowed if {
	true = true
}

todo_test_get_anonymous_denied if {
	true = true
}
