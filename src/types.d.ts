// Interfaces mostly derived from vscode.*, which allow for unit testing with native node --test.
export interface ITestController {
  /**
   * A collection of "top-level" TestItem instances, which can in turn have their own children to form the "test tree."
   *
   * The extension controls when to add tests. For example, extensions should add tests for a file when workspace.onDidOpenTextDocument fires in order for decorations for tests within a file to be visible.
   *
   * However, the editor may sometimes explicitly request children using the resolveHandler See the documentation on that method for more details.
   */
  items: ITestItemCollection;

  /**
   * Creates a new managed TestItem instance. It can be added into the TestItem.children of an existing item, or into the TestController.items.
   *
   * @param id
   * Identifier for the TestItem. The test item's ID must be unique in the TestItemCollection it's added to.
   * @param label — Human-readable label of the test item.
   * @param uri — URI this TestItem is associated with. May be a file or directory.
   */
  createTestItem(id: string, label: string, uri?: IUri): ITestItem;
  /**
   * Creates a TestRun. This should be called by the TestRunProfile when a request is made to execute tests, and may also be called if a test run is detected externally. Once created, tests that are included in the request will be moved into the queued state.
   *
   * All runs created using the same request instance will be grouped together. This is useful if, for example, a single suite of tests is run on multiple platforms.
   *
   * @param request Test run request. Only tests inside the include may be modified, and tests in its exclude are ignored.
   * @param name The human-readable name of the run. This can be used to disambiguate multiple sets of results in a test run. It is useful if tests are run across multiple platforms, for example.
   * @param persist Whether the results created by the run should be persisted in the editor. This may be false if the results are coming from a file already saved externally, such as a coverage information file.
   * @returns An instance of the TestRun. It will be considered "running" from the moment this method is invoked until TestRun.end is called.
   */
  createTestRun(request: ITestRunRequest, name?: string, persist?: boolean): ITestRun;
}

export interface ITestItemCollection {
  /**
   * Efficiently gets a test item by ID, if it exists, in the children.
   * @param itemId — Item ID to get.
   * @returns — The found item or undefined if it does not exist.
   */
  get(itemId: string): ITestItem | undefined;
  /**
   * Adds the test item to the children. If an item with the same ID already exists, it'll be replaced.
   * @param item — Item to add.
   */
  add(item: ITestItem): void;
  /**
   * Gets the number of items in the collection.
   */
  size: number;
  /**
   * Replaces the items stored by the collection.
   * @param items — Items to store.
   */
  replace(items: readonly ITestItem[]): void;
  /**
   * Iterate over each entry in this collection.
   * @param callback — Function to execute for each entry.
   * @param thisArg — The this context used when invoking the handler function.
   */
  forEach(callback: (item: ITestItem, collection: ITestItemCollection) => unknown, thisArg?: any): void;
  /**
   * Removes a single test item from the collection.
   *
   * @param itemId — Item ID to delete.
   */
  delete(itemId: string): void;
}

export interface ITestItem {
  /**
   * The children of this test item. For a test suite, this may contain the individual test cases or nested suites.
   */
  children: ITestItemCollection;
  /**
   * URI this TestItem is associated with. May be a file or directory.
   */
  uri: IUri | undefined;
  /**
   * Location of the test item in its uri.
   *
   * This is only meaningful if the uri points to a file.
   */
  range: IRange | undefined;
  /**
   * Display name describing the test case.
   */
  label: string;
  /**
   * Identifier for the TestItem. This is used to correlate test results and tests in the document with those in the workspace (test explorer). This cannot change for the lifetime of the TestItem, and must be unique among its parent's direct children.
   */
  id: string;
  /**
   * Controls whether the item is shown as "busy" in the Test Explorer view. This is useful for showing status while discovering children.
   *
   * Defaults to false.
   */
  busy: boolean;
  /**
   * The parent of this item. It's set automatically, and is undefined top-level items in the TestController.items and for items that aren't yet included in another item's children.
   */
  parent: ITestItem | undefined;
  /**
   * Tags associated with this test item. May be used in combination with tags, or simply as an organizational feature.
   */
  tags: readonly ITestTag[];
  /**
   * Indicates whether this test item may have children discovered by resolving.
   *
   * If true, this item is shown as expandable in the Test Explorer view and expanding the item will cause TestController.resolveHandler to be invoked with the item.
   *
   * Default to false.
   */
  canResolveChildren: boolean;
  /**
   * Optional error encountered while loading the test.
   *
   * Note that this is not a test result and should only be used to represent errors in test discovery, such as syntax errors.
   */
  error: string | IMarkdownString | undefined;
}

export interface ITestRunRequest {
  /**
   * An array of tests the user has marked as excluded from the test included in this run; exclusions should apply after inclusions.
   *
   * May be omitted if no exclusions were requested. Test controllers should not run excluded tests or any children of excluded tests.
   */
  exclude: readonly ITestItem[] | undefined;
  /**
   * A filter for specific tests to run. If given, the extension should run all of the included tests and all their children, excluding any tests that appear in TestRunRequest.exclude. If this property is undefined, then the extension should simply run all tests.
   *
   * The process of running tests should resolve the children of any test items who have not yet been resolved.
   */
  include: readonly ITestItem[] | undefined;
}

export interface ICancellationToken {
  /**
   * Is true when the token has been cancelled, false otherwise.
   */
  isCancellationRequested: boolean;
  /**
   * An Event which fires upon cancellation.
   */
  onCancellationRequested: IEvent<any>;
}

export interface IEvent<Type> {}

export interface ITextDocument {
  /**
   * The associated uri for this document.
   *
   * Note that most documents use the file-scheme, which means they are files on disk. However, not all documents are saved on disk and therefore the scheme must be checked before trying to access the underlying file or siblings on disk.
   *
   * @see — FileSystemProvider
   * @see — TextDocumentContentProvider
   */
  uri: IUri;
}

/**
 * A TestRun represents an in-progress or completed test run and provides methods to report the state of individual tests in the run.
 */
export interface ITestRun {
  /**
   * Indicates a test has failed. You should pass one or more TestMessages to describe the failure.
   *
   * @param test — Test item to update.
   * @param message — Messages associated with the test failure.
   * @param duration — How long the test took to execute, in milliseconds.
   */
  failed(test: ITestItem, message: ITestMessage | readonly ITestMessage[], duration?: number): void;
  /**
   * Indicates a test has passed.
   *
   * @param test — Test item to update.
   * @param duration — How long the test took to execute, in milliseconds.
   */
  passed(test: ITestItem, duration?: number): void;
  /**
   * Indicates a test is queued for later execution.
   *
   * @param test — Test item to update.
   */
  enqueued(test: ITestItem): void;
  /**
   * Appends raw output from the test runner. On the user's request, the output will be displayed in a terminal. ANSI escape sequences, such as colors and text styles, are supported. New lines must be given as CRLF (\r\n) rather than LF (\n).
   *
   * @param output — Output text to append.
   * @param location Indicate that the output was logged at the given location.
   * @param test — Test item to associate the output with.
   */
  appendOutput(output: string, location?: ILocation, test?: ITestItem): void;
  /**
   * Indicates a test has been skipped.
   *
   * @param test — Test item to update.
   */
  skipped(test: ITestItem): void;
  /**
   * Indicates a test has started running.
   *
   * @param test — Test item to update.
   */
  started(test: ITestItem): void;
  /**
   * Signals the end of the test run. Any tests included in the run whose states have not been updated will have their state reset.
   */
  end(): void;
  /**
   * A cancellation token which will be triggered when the test run is canceled from the UI.
   */
  token: ICancellationToken;
}

export interface ILocation {}

export interface IUri {
  /**
   * Scheme is the http part of http://www.example.com/some/path?query#fragment. The part before the first colon.
   */
  scheme: string;
  /**
   * Path is the /some/path part of http://www.example.com/some/path?query#fragment.
   */
  path: string;
  /**
   * Authority is the www.example.com part of http://www.example.com/some/path?query#fragment. The part between the first double slashes and the next slash.
   */
  authority: string;
  /**
   * Query is the query part of http://www.example.com/some/path?query#fragment.
   */
  query: string;
  /**
   * Fragment is the fragment part of http://www.example.com/some/path?query#fragment.
   */
  fragment: string;
  /**
   * The string representing the corresponding file system path of this Uri.
   *
   * Will handle UNC paths and normalize windows drive letters to lower-case. Also uses the platform specific path separator.
   *
   * Will not validate the path for invalid characters and semantics.
   * Will not look at the scheme of this Uri.
   * The resulting string shall not be used for display purposes but for disk operations, like readFile et al.
   * The difference to the path-property is the use of the platform specific path separator and the handling of UNC paths. The sample below outlines the difference:
   * ```
   * const u = URI.parse('file://server/c$/folder/file.txt')
   * u.authority === 'server'
   * u.path === '/c$/folder/file.txt'
   * u.fsPath === '\\server\c$\folder\file.txt'
   * ```
   */
  fsPath: string;
  /**
   * Derive a new Uri from this Uri.
   * ```
   * let file = Uri.parse('before:some/file/path');
   * let other = file.with({ scheme: 'after' });
   * assert.ok(other.toString() === 'after:some/file/path');
   * ```
   * @param change An object that describes a change to this Uri. To unset components use null or the empty string.
   * @returns A new Uri that reflects the given change. Will return this Uri if the change is not changing anything.
   */
  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): IUri;
  /**
   * Returns a string representation of an object.
   */
  toString(): string;
  /**
   * Returns a JSON representation of this Uri.
   * @returns — An object.
   */
  toJSON(): any;
}

/**
 * A relative pattern is a helper to construct glob patterns that are matched relatively to a base file path. The base path can either be an absolute file path as string or uri or a workspace folder, which is the preferred way of creating the relative pattern.
 */
export interface IRelativePattern {}

/**
 * Tags can be associated with TestItems and TestRunProfiles. A profile with a tag can only execute tests that include that tag in their TestItem.tags array.
 */
export interface ITestTag {}

/**
 * A range represents an ordered pair of two positions. It is guaranteed that start.isBeforeOrEqual(end)
 *
 * Range objects are immutable. Use the with, intersection, or union methods to derive new ranges from an existing range.
 */
export interface IRange {
  start: IPosition;
  end: IPosition;
}

/**
 * Represents a line and character position, such as the position of the cursor.
 *
 * Position objects are immutable. Use the with or translate methods to derive new positions from an existing position.
 * @param line — A zero-based line value.
 * @param character — A zero-based character value.
 */
export interface IPosition {
  line: number;
  character: number;
}

/**
 * A file glob pattern to match file paths against. This can either be a glob pattern string (like **​/*.{ts,js} or *.{ts,js}) or a relative pattern.
 *
 * Glob patterns can have the following syntax:
 *
 * - \* to match zero or more characters in a path segment
 * - ? to match on one character in a path segment
 * - ** to match any number of path segments, including none
 * - {} to group conditions (e.g. **​/*.{ts,js} matches all TypeScript and JavaScript files)
 * - [] to declare a range of characters to match in a path segment (e.g., example.[0-9] to match on example.0, example.1, …)
 * - [!...] to negate a range of characters to match in a path segment (e.g., example.[!0-9] to match on example.a, example.b, but not example.0)
 *
 * Note: a backslash (\) is not valid within a glob pattern. If you have an existing file path to match against, consider to use the relative pattern support that takes care of converting any backslash into slash. Otherwise, make sure to convert any backslash to slash when creating the glob pattern.
 */
export type GlobPatternType = string | IRelativePattern;

/**
 * Creates a new TestMessage instance.
 */
export interface ITestMessage {}

export interface IMarkdownString {}

/**
 * Find files across all workspace folders in the workspace.
 *
 * @example
 * findFiles('**​/*.js', '**​/node_modules/**', 10)
 *
 * @param include
 * A glob pattern that defines the files to search for. The glob pattern will be matched against the file paths of resulting matches relative to their workspace. Use a relative pattern to restrict the search results to a workspace folder.
 * @param exclude
 * A glob pattern that defines files and folders to exclude. The glob pattern will be matched against the file paths of resulting matches relative to their workspace. When undefined, default file-excludes (e.g. the files.exclude-setting but not search.exclude) will apply. When null, no excludes will apply.
 * @param maxResults — An upper-bound for the result.
 * @param token — A token that can be used to signal cancellation to the underlying search engine.
 * @returns
 * A thenable that resolves to an array of resource identifiers. Will return no results if no workspace folders are opened.
 */
export interface IFindFilesFunc {
  (pattern: string): Thenable<IUri[]>;
}

/**
 * Read the entire contents of a file.
 * @param uri — The uri of the file.
 * @returns — An array of bytes or a thenable that resolves to such.
 */
export interface IReadFileFunc {
  (uri: IUri): Thenable<Uint8Array>;
}

export interface IOnTestHanderFunc {
  (packageName: string | null, testName: string, range: IRange): void;
}

export interface IGetConfigFunc {
  (): { cwd: string | undefined; testFilePatterns: string[]; policyTestDir: string; opaCommand: string };
}

export interface IOpaTestResult {
  location: {
    file: string;
    row: number;
    col: number;
  };
  package: string;
  name: string;
  fail?: boolean;
  duration: number;
}
