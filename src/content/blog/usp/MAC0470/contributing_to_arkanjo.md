---
title: "Contributing to the ArKanjo Project"
date: 2026-07-12
description: "A blog post about my experience during the 1nd phase of MAC0470 2026"
---

This post is an account of my experience during the 2nd phase of the Open Source Software Development course at the University of São Paulo. In this phase we had to contribute to an open source project related to the Linux world. As before, I worked alongside [Raffael Raiél](https://rfflrt.github.io/).

Initially we decided to contribute to the [Mailing List Heritage](https://gitlab.com/ccsl-usp/codev/MailingListsHeritage/) (MLH), prompted by an interest in learning Rust. However, I underestimated the difficulties of working in a different timezone from Raffa, as well as the inherent complexity of the MLH issues — both in learning a new language and in the features they required — while simultaneously overestimating how much time I would have after moving to London to start my internship. In the end we decided to fall back to a language we were already comfortable with, and to a project where Raffa could more easily ask questions during the MAC0470 classes. We therefore moved to the ArKanjo project, developed by [Guilherme Ivo](https://github.com/guilhermeivo), which aims to detect code duplication using different tools.

# Initial Bug Fix and Gaining familiarity with the repository

We started by tackling issue [#41 "TOTAL NUMBER LINES IN FUNCTION is always -1 in cluster output"](https://github.com/arkanjo-tool/arkanjo/issues/41). It was a good way to get familiar with the repository while already contributing something useful.

The bug lived in how ArKanjo builds the entries it later prints for the cluster (`-c`) output. The original code looked like this:

```cpp
struct SimilarityExplorerEntry {
  std::string path_a;
  std::string path_b;
  std::string dir_a;
  std::string dir_b;
  std::string filename_a;
  std::string filename_b;
  std::string func_a;
  std::string func_b;
  int start_a;
  int start_b;
  int end_a;
  int end_b;
  int duplicated_lines{-1};
};
```

```
std::vector<SimilarityExplorerEntry> entries{};
for (const auto& path : info.paths) {
    entries.push_back({
        path.format_path_message_in_pair(),"",
        path.build_relative_path().parent_path().string(),"",
        path.build_relative_path().filename().string(),"",
        path.build_function_name(),"",
        find_number_lines(path)
    });
}
```

Two things stood out. First, the initializer passes fewer arguments than `SimilarityExplorerEntry` actually declares, so several fields were being filled implicitly. Second, the line count came from a small wrapper, `find_number_lines`:

```cpp
int SimilarityExplorer::find_number_lines(const Path& path1) {
    Function function(path1);
    function.load();
    return function.number_of_lines();
}
```

which just loads the function from the path and asks it for its number of lines.

Rather than patch the wrapper, we chose to build each entry with the full set of fields it expects. The cluster output only deals with a single "a" function per line, so there is no matching "b" function. Therefore, for those slots in the arguments we can pass surrogate values (`0`) instead of leaving them undefined. Building the `Function` once inside the loop also let us read its scope directly, which is what the entry needs. The result was:

```cpp
std::vector<SimilarityExplorerEntry> entries{};
for (const auto& path : info.paths) {
    Function function(path);
    function.load();
    entries.push_back({
        path.format_path_message_in_pair(), "",
        path.build_relative_path().parent_path().string(), "",
        path.build_relative_path().filename().string(), "",
        path.build_function_name(), "",
        function.get_scope_function_in_file()[0], 0,
        function.get_scope_function_in_file()[2], 0,
        function.number_of_lines()
    });
}
```

Since the line count is now computed inline, the `find_number_lines` wrapper became dead code, so we removed it from both `similarity_explorer.cpp` and its header `similarity_explorer.hpp`.

With that change, output that used to report `-1` for every function:

```
Cluster #5 (Files: 8, Pairs: 28, Lines: 504, Score: 209.400000)
---------------------
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/code.c::find_min, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_equal_code/code.c::find_max, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_equal_code/code.c::find_min, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/source.c::find_min, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/source.c::find_max, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_equal_code/source.c::find_max, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_equal_code/source.c::find_min, TOTAL NUMBER LINES IN FUNCTION: -1
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/code.c::find_max, TOTAL NUMBER LINES IN FUNCTION: -1
```

now reports the real line counts:

```
Cluster #5 (Files: 8, Pairs: 28, Lines: 504, Score: 209.400000)
---------------------
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/code.c::find_min, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_equal_code/code.c::find_max, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_equal_code/code.c::find_min, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/source.c::find_min, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/source.c::find_max, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_equal_code/source.c::find_max, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_equal_code/source.c::find_min, TOTAL NUMBER LINES IN FUNCTION: 9
Function find: tests/e2e/codebase/test_multiple_file_shuffled_functions/code.c::find_max, TOTAL NUMBER LINES IN FUNCTION: 9
```

This contribution was merged right away, since it fixed the problem in a straightforward way. The commit can be found [here](https://github.com/arkanjo-tool/arkanjo/commit/6d290a88f36ddd65d7c71d34e166d5cbfa72e793).

# Follow up interactions

After the initial contribution, we tried to run ArKanjo against [USP Aurora](https://github.com/usp-aurora/aurora). Along the way we ran into a few interesting issues:

- **libgit2 dependency issue**: on my macOS machine, the CMake reference for libgit2 did not detect my libgit2 installation.
- **PHP tree-sitter problems**: due to the nature of the PHP tree-sitter output, it did not work with the current ArKanjo code.
- **Path references**: paths using `~` were not being expanded.

Another interesting problem was that I spent a good while running the program and thinking "no duplications, all fine", only because I had forgotten to add Aurora's languages to ArKanjo's `.config` file. This led me to open [this](https://github.com/arkanjo-tool/arkanjo/issues/62) feature request, asking the tool to warn users when it silently skips unconfigured languages.

<figure>
  <img src="/documents/blog/usp/MAC0470/dog_fire_meme.jpg" alt="This is fine dog sitting in a burning room" />
  <figcaption>Me, staring at "no duplications, all fine".</figcaption>
</figure>

For the libgit2 problem we proposed a PR. Both fixes live in `cmake/Targets.cmake`, around the `if(ARKANJO_LIBGIT2_SYSTEM)` branch that selects between a system-provided libgit2 and the bundled one. In the system branch, we changed the raw library name

```cmake
set(ARKANJO_LIBGIT2_LIBS git2)
```

to the imported target that the system package actually exports

```cmake
set(ARKANJO_LIBGIT2_LIBS libgit2::libgit2package)
```

so linking resolves against the installed libgit2 instead of a bare `git2` guess. Then, in the include directories, I wrapped the bundled headers path

```cmake
${libgit2_SOURCE_DIR}/include
```

in a generator expression

```cmake
$<$<NOT:$<BOOL:${ARKANJO_LIBGIT2_SYSTEM}>>:${libgit2_SOURCE_DIR}/include>
```

so that the bundled include path is added only when we are *not* using the system libgit2 — otherwise CMake would point at a source directory that doesn't exist in the system build. This change is waiting to be reviewed and merged.

# Future contributions

We are currently waiting for [fix: support tree-sitter grammars with custom directories](https://github.com/arkanjo-tool/arkanjo/pull/60) to be merged so we can run the tool against USP Aurora again and analyse the result. I'm also waiting on a response to the issue about warning users of unanalysed languages, and I'd be glad to help build that feature if the maintainer considers it worthwhile.
