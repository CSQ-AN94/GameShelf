# Local Game Library

A local-first library for launching and organizing games of any genre or content rating, with package, save, and privacy features.

## Language

**Game**:
A locally managed playable title. A Game may have any Game Type or Content Rating and may contain one or more Launch Targets.
_Avoid_: GalGame as the generic name for every managed title

**Game Type**:
The form of a Game, such as Visual Novel, RPG, Simulation, or Other.
_Avoid_: treating R18 as a game type

**Content Rating**:
The maturity classification of a Game or Play Profile, independent of Game Type. A Play Profile inherits its Game's rating unless its selected Packages change the effective rating; R18 is a Content Rating.
_Avoid_: Genre

**Tag**:
A user-defined reusable label for organizing and finding Games, independent of Game Type and Content Rating.
_Avoid_: Genre, Content Rating

**Launch Target**:
An executable, link, or trusted script that can start a Game, including its arguments and working directory.
_Avoid_: Version, Start Method

**Play Profile**:
A named, reproducible way to play a Game, combining one Launch Target with selected Packages, one Save Branch, and optional launch helpers.
_Avoid_: Multi-launch Item, Mod Profile

**Package**:
An imported set of files associated with a Game. A Package is categorized as a Mod, translation patch, adult-content patch, voice pack, fix, or other user-defined kind.
_Avoid_: using Mod for every kind of package

**Save Location**:
One or more directories containing a Game's save data.
_Avoid_: Save File

**Save Branch**:
A named line of save data associated with a Play Profile, kept separate from other ways of playing the same Game.
_Avoid_: Account

**Save Snapshot**:
A point-in-time restorable archive of a Save Branch.
_Avoid_: Cloud Save, Sync

**Play Session**:
One measured interval from launching a Game until its tracked process exits.
_Avoid_: Play Record

**Safe View**:
A presentation mode that hides sensitive titles, artwork, Play Profiles, activity, and search results while leaving eligible profiles available. Safe View is not encryption and does not conceal files outside the application.
_Avoid_: Privacy Lock
