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
}

export interface ITestItem {}

export interface ITestRunRequest {}

export interface ICancellationToken {}

export interface ITextDocument {}

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
   * Returns a string representation of an object.
   */
  toString(): string;
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
export interface IGlobPattern {}

export interface IThenable<Type> {}

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
export interface FindFilesFunc {
  (pattern: string): IThenable<IUri>;
}
