@echo off
setlocal
set SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/gx_geo_news?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false
set SPRING_DATASOURCE_USERNAME=root
set SPRING_DATASOURCE_PASSWORD=su2232783120
set APP_IMPORT_ON_STARTUP=false
set APP_AUTO_CRAWL_ON_STARTUP=false
set APP_CRAWL_FIRST_START=2024-01-01T00:00:00
set APP_IMPORT_ROOT=D:\DiXinYuan\datasets
set CRAWL_TRIGGER_TOKEN=local-dev-token
"C:\Program Files\Java\jdk-21\bin\java.exe" -jar "D:\DiXinYuan\backend\target\gx-geo-news-backend-0.1.0.jar" 1>>"D:\DiXinYuan\backend\backend.out.log" 2>>"D:\DiXinYuan\backend\backend.err.log"
