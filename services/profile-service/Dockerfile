FROM gradle:8.10.2-jdk21 AS build

WORKDIR /workspace
COPY build.gradle.kts settings.gradle.kts /workspace/
COPY src /workspace/src
RUN gradle --no-daemon clean bootJar

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar /app/app.jar

ENV SERVER_PORT=8091
EXPOSE 8091

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
