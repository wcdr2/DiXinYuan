package cn.dixinyuan.news;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync
@EnableScheduling
@MapperScan("cn.dixinyuan.news.mapper")
@SpringBootApplication
public class GxGeoNewsApplication {
  public static void main(String[] args) {
    SpringApplication.run(GxGeoNewsApplication.class, args);
  }
}
