FROM gradle:8.10.2-jdk21 AS build

WORKDIR /workspace
COPY . .
RUN gradle --no-daemon clean bootJar

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar /app/service.jar

ENV SERVER_PORT=8097
EXPOSE 8097

ENTRYPOINT ["java", "-jar", "/app/service.jar"]
