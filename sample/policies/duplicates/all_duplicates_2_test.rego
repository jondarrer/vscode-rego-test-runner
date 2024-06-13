package duplicates.all_duplicates_1_test

import rego.v1

import data.duplicates.sample

test_post_allowed if {
	not sample.allow with input as {"path": ["users"], "method": "POST"}
}

test_get_anonymous_denied if {
	sample.allow with input as {"path": ["users"], "method": "GET"}
}
