# change-summary Specification

## Purpose
Defines the orientation summary that can be generated for a single OpenSpec
change: which artifacts it is derived from and which it is forbidden to read,
what it must contain, how its language is chosen, where it is written, and what
is reported back once it exists.
## Requirements
### Requirement: One change per invocation, asked when not supplied

Summarizing SHALL act on exactly one change. When the target is supplied it
SHALL be confirmed to exist among the changes of the resolved OpenSpec root
before anything is read; when it is not supplied the user SHALL be asked which
change to summarize, even when only one change is open. Summarizing several
changes in one invocation SHALL NOT be offered.

#### Scenario: Target supplied

- **WHEN** the user names a change that exists in the resolved root
- **THEN** that change is summarized and no selection question is asked

#### Scenario: Target not supplied

- **WHEN** the user asks for a summary without naming a change
- **THEN** the open changes are presented as a selection and none is read until one is chosen

#### Scenario: Only one change is open

- **WHEN** exactly one change is open and none was named
- **THEN** the user is still asked to confirm it rather than having it chosen for them

#### Scenario: Unknown change named

- **WHEN** the named change does not exist in the resolved root
- **THEN** the summary is not written, and the response names the change requested and the changes that do exist

### Requirement: An archived change is summarized only after confirmation

A change under the archive SHALL NOT be read or summarized until the user has
confirmed that specific target by name. Declining SHALL leave the archived
change untouched and write nothing.

#### Scenario: Archived target is confirmed first

- **WHEN** the requested change lives under the archive
- **THEN** confirmation naming that archived change is obtained before its artifacts are read

#### Scenario: Declining an archived target

- **WHEN** the user declines the confirmation for an archived change
- **THEN** nothing is read further and no file is written

### Requirement: The summary is derived only from the intent artifacts

The summary SHALL be derived from `proposal.md`, `design.md` and the change's
spec files, and from nothing else. It SHALL NOT read `tasks.md`, git history, or
any source file. Where the change listing consulted to locate a change
incidentally carries task counts or completion status, that information SHALL NOT
enter the summary. The summary SHALL NOT report progress, counts of completed
work, or implementation status, and therefore describes what the change intends
and how it is shaped, never how far along it is.

#### Scenario: Progress is absent from a partially implemented change

- **WHEN** a change with some tasks completed and others outstanding is summarized
- **THEN** the summary states no progress, no task counts, and no completion status

#### Scenario: Task changes do not change the summary

- **WHEN** a change is summarized, its task list is then edited or completed, and it is summarized again in the same language
- **THEN** the newly written summary is materially unchanged, because no task content ever entered it

#### Scenario: Code is not consulted

- **WHEN** the change is partially implemented in the repository
- **THEN** the summary reflects only what the artifacts state, and no claim is drawn from the code

### Requirement: The summary states purpose, scope and affected capabilities

The summary SHALL open with a single sentence naming what the change does, and
SHALL then state why the change exists, what it changes, what it explicitly
excludes, and which capabilities its spec files touch. It SHALL end by naming the
artifacts it was derived from, so a reader who needs more can go straight to
them.

#### Scenario: A reader can reach the source

- **WHEN** a summary is written for a change with a proposal, a design and two spec files
- **THEN** the summary names each of those artifacts as where to read further

#### Scenario: Excluded scope survives compression

- **WHEN** the proposal declares non-goals or out-of-scope items
- **THEN** they appear in the summary rather than being dropped as detail

#### Scenario: Capabilities are named

- **WHEN** the change carries spec deltas for one or more capabilities
- **THEN** each capability is named in the summary

### Requirement: Decisions are recorded with the alternative each one beat

For every decision the design records, the summary SHALL state the choice made,
the alternative it was chosen over, and the reason — a decision reported without
its rejected alternative is incomplete, because the reader cannot tell what was
already considered. When the change has no design document, the summary SHALL say
so explicitly, so that "no decisions were recorded" is never mistaken for "no
decisions exist".

#### Scenario: A decision carries its alternative

- **WHEN** the design records a choice made over a named alternative
- **THEN** the summary states the choice, that alternative, and why the choice won

#### Scenario: No design document

- **WHEN** the change has no design document
- **THEN** the summary states that no design decisions were recorded, rather than silently omitting the section

### Requirement: The summary compresses rather than reproduces

The summary SHALL be short enough to read before opening the artifacts it
describes. It SHALL NOT reproduce requirement text or scenarios one by one, and
SHALL NOT copy sections of the source artifacts verbatim where a compression
would serve. Length SHALL stay within roughly one screen of text.

#### Scenario: Requirements are not transcribed

- **WHEN** a change carries many requirements and scenarios across several spec files
- **THEN** the summary names the capabilities and characterizes what they require, without listing each requirement

#### Scenario: Long artifacts still yield a short summary

- **WHEN** the source artifacts together run to many pages
- **THEN** the summary remains within roughly one screen

### Requirement: The language is always chosen by the user

Before writing, the user SHALL be asked which language to write the summary in,
and the choice SHALL be offered as exactly two options: English and pt-BR. The
language in which the change's own prose is written SHALL be offered first, as
the recommended option, determined from the prose of the artifacts rather than
from their structural markers, requirement keywords, code, paths or identifiers.
The question SHALL be asked in every case, including when the change is already
written in pt-BR. No summary SHALL be written before the question is answered.

#### Scenario: A pt-BR change is still asked

- **WHEN** the change's artifacts are written in pt-BR
- **THEN** the user is asked which language to use, with pt-BR offered as the first option

#### Scenario: An English change is still asked

- **WHEN** the change's artifacts are written in English
- **THEN** the user is asked which language to use, with English offered as the first option

#### Scenario: The chosen language wins over the detected one

- **WHEN** the change is written in English and the user chooses pt-BR
- **THEN** the summary is written in pt-BR

#### Scenario: Structure does not decide the language

- **WHEN** a change written in pt-BR prose carries English structural markers and requirement keywords in its spec files
- **THEN** pt-BR is the language offered first

#### Scenario: Question unanswered

- **WHEN** the language question is dismissed without an answer
- **THEN** no file is written

### Requirement: One file, at a path that does not vary with language

The summary SHALL be written to `summary.md` inside the change's own directory,
and that SHALL be the only file the summarizing writes. The filename SHALL NOT
vary with the chosen language, so that anything referring to a change's summary
can refer to one path. A previous summary at that path SHALL be overwritten
rather than versioned alongside, since version history belongs to the repository.

#### Scenario: Path is stable across languages

- **WHEN** the user chooses pt-BR for a change whose artifacts are English
- **THEN** the file written is the change's `summary.md`, under no other name

#### Scenario: Regenerating replaces

- **WHEN** a summary already exists for the change and a new one is generated
- **THEN** the existing file is replaced and no second summary file is left behind

#### Scenario: Nothing else is written

- **WHEN** a summary is generated
- **THEN** no artifact of the change other than `summary.md` is created or modified

### Requirement: The summary is not reproduced in the response

The summary SHALL NOT be reproduced as the text of the response. What is
reported SHALL be the path written and the language it was written in, so that
the user can tell the write succeeded and where to read it.

#### Scenario: Path and language are reported

- **WHEN** a summary has been written
- **THEN** the response states the path of the file and the language used

#### Scenario: Content stays in the file

- **WHEN** a summary has been written
- **THEN** its content is not restated in the response

### Requirement: Summarizing describes and does not judge

The summary SHALL contain no verdict, no findings, no severity ratings, no
recommendations, and no verification of the claims the change makes. Where the
artifacts appear inconsistent with each other, the summary SHALL at most point
once to reviewing the change, and SHALL NOT itself report the inconsistency as a
finding.

#### Scenario: No verdict

- **WHEN** any change is summarized
- **THEN** the summary contains no assessment of whether the change is good, correct, complete or ready

#### Scenario: An inconsistency is deferred, not diagnosed

- **WHEN** the artifacts contradict one another
- **THEN** the summary points once to reviewing the change and does not enumerate the contradiction as a finding
