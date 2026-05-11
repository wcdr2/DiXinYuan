$env:SPRING_DATASOURCE_URL = 'jdbc:mysql://localhost:3306/gx_geo_news?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false'
$env:SPRING_DATASOURCE_USERNAME = 'root'
$env:SPRING_DATASOURCE_PASSWORD = 'su2232783120'
$env:APP_IMPORT_ON_STARTUP = 'false'
$env:APP_AUTO_CRAWL_ON_STARTUP = 'false'
$env:APP_CRAWL_FIRST_START = '2024-01-01T00:00:00'
$env:CRAWL_TRIGGER_TOKEN = 'local-dev-token'
Set-Location 'D:\DiXinYuan\backend'
& 'D:\Maven\apache-maven-3.8.3\bin\mvn.cmd' spring-boot:run
