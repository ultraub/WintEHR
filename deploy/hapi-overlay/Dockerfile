# HAPI FHIR overlay — wraps the upstream JPA starter with a small admin
# endpoint that flushes the cqf-fhir-cr in-memory caches.
#
# Why this exists: cqf-fhir-cr-hapi caches compiled CQL ELM and ValueSet
# expansions in JVM memory keyed by Library/ValueSet identifier. The
# CodeCacheResourceChangeListener that's supposed to invalidate on PUT
# doesn't fire in our deployment for reasons we couldn't isolate from
# outside the JVM (the bean isn't registered in startup logs even with
# subscriptions enabled). Without manual cache flushing, student edits to
# a ValueSet aren't reflected in CQL retrieves until a full HAPI restart.
#
# This overlay builds the upstream `hapi-fhir-jpaserver-starter` from
# source at our pinned tag, drops in a single @RestController that exposes
# POST /admin/cr/flush-caches, and produces a runtime image that's
# drop-in compatible with the upstream `hapiproject/hapi:v8.6.0-1` we
# were using before.
#
# Maintenance: when upgrading HAPI, bump HAPI_VERSION below. The Java
# class only depends on stable cqf-fhir public APIs (`EvaluationSettings`
# has been in CR since 3.x); upgrades should be clean.

ARG HAPI_VERSION=image/v8.6.0-1

# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-17 AS build
ARG HAPI_VERSION

WORKDIR /work

# Clone the upstream starter at the exact tag so we're building the same
# binary the official image ships, plus our additions.
RUN git clone --depth 1 --branch ${HAPI_VERSION} \
    https://github.com/hapifhir/hapi-fhir-jpaserver-starter.git starter

# Drop our admin controller into the starter's source tree. Spring's
# @ComponentScan picks up everything under `ca.uhn.fhir.jpa.starter`,
# so adding a class to the `admin` sub-package auto-registers it.
COPY src/main/java/ca/uhn/fhir/jpa/starter/admin/ \
     /work/starter/src/main/java/ca/uhn/fhir/jpa/starter/admin/

WORKDIR /work/starter

# Build the WAR. Skip tests — we trust the upstream's tests on the pinned
# tag, and our addition has its own coverage in the backend integration
# layer (the round-trip "edit ValueSet → rule reflects new content"
# test).
RUN mvn -B -DskipTests=true -Pboot package

# ---------- Runtime stage ----------
# Match the upstream image's runtime base so behavior stays identical
# beyond our addition. The upstream image is distroless; we use a JRE
# image to keep parity with what we actually want (a Java runtime)
# without tying ourselves to the distroless restrictions that made
# debugging the listener registration so painful.
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Copy the built executable WAR. Spring Boot's launcher-aware WAR works
# with `java -jar`, no Tomcat install needed.
COPY --from=build /work/starter/target/*.war /app/main.war

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/main.war"]
