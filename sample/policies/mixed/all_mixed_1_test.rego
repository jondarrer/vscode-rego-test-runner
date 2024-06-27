package mixed.all_mixed_1_test

import rego.v1

import data.mixed.sample

test_post_allowed if {
	sample.allow with input as {"path": ["users"], "method": "POST"}
}

test_get_anonymous_denied if {
	sample.allow with input as {"path": ["users"], "method": "GET"}
}
