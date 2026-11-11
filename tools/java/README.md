# Java

Lets agents build and run Java projects: Java 25 (the Eclipse Temurin JDK) and Maven.

- **Commands**: `java`, `javac`, `jar`, `javadoc`, `javap`, `jshell`, `jcmd`, `jps`, `jstack`,
  `jdeps`, `jlink`, `keytool`, `mvn`; the JDK's other tools are in `$JAVA_HOME/bin`.
- **Reaches**: Maven Central (repo.maven.apache.org). A project using another repository needs
  its host allowed for the agent.
- **Keeps**: Maven's packages and plugins (`~/.m2`), as your project's caches setting says.
- **Updates**: every rebuild installs the latest Java 25 and Maven 3.
- **Size**: about 320 MB.

Gradle is not included: a project's Gradle wrapper (`./gradlew`) downloads it, from
services.gradle.org, which you then allow for the agent.
