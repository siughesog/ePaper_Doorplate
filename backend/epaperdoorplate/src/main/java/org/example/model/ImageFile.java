package org.example.model;




import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "images")
public class ImageFile {

    @Id
    private String id;

    private String name;        // 原始檔案名稱
    private String path;        // 儲存在本機或伺服器的檔案路徑
    private Instant uploadTime;
    private String userId;      // 上傳用戶ID

    public ImageFile() {}

    public ImageFile(String name, String path, Instant uploadTime) {
        this.name = name;
        this.path = path;
        this.uploadTime = uploadTime;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public Instant getUploadTime() { return uploadTime; }
    public void setUploadTime(Instant uploadTime) { this.uploadTime = uploadTime; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}

