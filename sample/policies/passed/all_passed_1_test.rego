package passed.all_passed_1_test

import rego.v1

import data.passed.sample

test_post_allowed if {
	sample.allow with input as {"path": ["users"], "method": "POST"}
}
