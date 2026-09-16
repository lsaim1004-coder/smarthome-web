# ---- build stage ----
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package && cp target/*.jar app.jar

# ---- runtime stage ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S -G app app
# 상담 신청 사진이 쌓이는 곳. compose 가 이름 있는 볼륨을 여기 마운트한다.
# 비어 있는 볼륨은 이미지의 디렉터리 소유권을 물려받으므로, USER 를 바꾸기 전에 만들어 둬야
# app(uid 100) 이 쓸 수 있다. 이미 만들어진 볼륨은 deploy.sh 가 한 번 소유권을 맞춘다.
RUN mkdir -p /data/uploads && chown -R app:app /data
WORKDIR /app
COPY --from=build /build/app.jar /app/app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
