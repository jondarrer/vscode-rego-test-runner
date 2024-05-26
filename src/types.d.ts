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
}

export interface ITestRunRequest {}

export interface ICancellationToken {}

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
  (testName: string, range: IRange): void;
}
