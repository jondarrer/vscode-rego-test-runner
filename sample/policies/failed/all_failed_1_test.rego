package failed.all_failed_1_test

import rego.v1

import data.failed.sample

test_post_allowed if {
	not sample.allow with input as {"path": ["users"], "method": "POST"}
}
