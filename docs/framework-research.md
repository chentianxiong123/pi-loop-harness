# 项目框架选型研究：若依 × SpringBoot → Go

> 目的：为 pi-loop-harness 搭建"项目框架"（GO + SQLite + HTMX，类比 SpringBoot / 若依）做准备。
> 研究方式：SpringBoot 核心机制 + 若依结构拆解 + Go 生态对照。
> 研究日期：2026-08-27

---

## 一、SpringBoot 核心机制（要复刻的能力）

### 1.1 自动配置（Auto-Configuration）——最大的魔法

**本质**：基于条件注解的动态 JavaConfig 配置类集合，启动时扫描、条件匹配后批量注册 Bean。

**执行链路**：
```
@SpringBootApplication
  └─ @EnableAutoConfiguration
       └─ @Import(AutoConfigurationImportSelector)
            ├─ 读 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
            ├─ 去重
            ├─ 应用 exclude 排除
            ├─ @Conditional 条件过滤（只有满足的保留）
            └─ 注册最终 Bean
```

**关键条件注解**（决定"按需加载"）：

| 注解 | 作用 |
|------|------|
| `@ConditionalOnClass` | classpath 有指定类才生效（依赖存在才装配）|
| `@ConditionalOnMissingBean` | 用户没自定义才提供默认 Bean（**用户优先**）|
| `@ConditionalOnProperty` | 配置项开关控制 |
| `@ConditionalOnWebApplication` | Web 环境才生效 |

### 1.2 Starter 模式——场景化接入入口

> Starter 不是"把几个依赖放一起"，而是**场景化入口 + 自动装配 + 配置绑定 + 默认 Bean + 用户覆盖 + 监控**。

业界推荐拆分三层：
```
hospital-client-sdk          真正客户端能力（HTTP/签名/重试），不依赖 Boot
hospital-spring-boot-autoconfigure  自动配置类 + 属性绑定 + 条件装配 + 健康检查
hospital-spring-boot-starter 依赖聚合入口（几乎不写代码）
```

### 1.3 配置体系
`application.yml` 分层 + `@ConfigurationProperties` 类型安全绑定 + profile（多环境）。

### 1.4 常用内置 Starter 模块

| Starter | 解决什么 |
|---------|---------|
| spring-boot-starter-web | Web 应用（内嵌 Tomcat + MVC）|
| spring-boot-starter-security | 认证授权 |
| spring-boot-starter-data-jpa | 数据访问 |
| spring-boot-starter-actuator | 监控端点（健康/指标/条件诊断）|
| spring-boot-starter-validation | 参数校验 |
| spring-boot-starter-cache | 缓存抽象 |
| spring-boot-starter-quartz | 定时任务 |

### 1.5 工程化配套
- 统一异常处理 `@RestControllerAdvice` + `GlobalExceptionHandler`
- 监控：Actuator（`/actuator/conditions` 直接查自动配置诊断）
- 启动流程：`SpringApplication.run` → 上下文 → 自动装配 → 就绪

---

## 二、若依（RuoYi）——"开箱即用的管理系统"

### 2.1 模块化结构

```
ruoyi-admin      启动模块（主程序）
ruoyi-common     公共模块（工具类、通用组件）
ruoyi-framework  框架模块（核心配置、权限控制）
ruoyi-system     系统模块（用户/角色/菜单/部门）
ruoyi-generator  代码生成模块
ruoyi-quartz     定时任务模块
```

### 2.2 内置功能清单（18 项）
用户/部门/岗位/菜单/角色/字典/参数管理、操作日志、登录日志、在线用户、定时任务、**代码生成**、系统接口(Swagger)、服务监控、缓存监控、在线构建器、连接池监视。

### 2.3 RBAC 权限模型（5 张核心表）
```
sys_user ── sys_user_role ── sys_role ── sys_role_menu ── sys_menu
用户          用户角色        角色        角色菜单         菜单(按钮/权限标识)
```
流程：登录生成 JWT → 请求带 token → 注解级权限校验（`@PreAuthorize`）。

### 2.4 代码生成器（核心价值）
1. 读取数据库表元数据（字段/类型/注释）
2. Velocity 模板引擎渲染
3. 输出全套代码：Entity / Mapper / Service / Controller / 前端页面 / SQL 脚本

模板类型：单表 CRUD / 树形结构 / 主子表。
配置：`generator.yml`（作者、包名、去表前缀）+ 模板目录 `resources/vm/`。

### 2.5 技术栈
Spring Boot + MyBatis(-Plus) + Spring Security/Shiro + JWT + MySQL + Redis + Quartz + Swagger。

---

## 二.5、源码实读（2026-08-27 克隆 yangzongzhuan/RuoYi 到 /mnt/shared/ruoyi）

> 上面第二、四、五节为初版二手资料整理，本节为**直接读源码**后的校正版，以本节为准。

### 2.5.1 模块与依赖关系（pom.xml 实读）

```
根 pom (packaging=pom)
├─ ruoyi-admin      启动模块（RuoYiApplication + web/controller 全放这）
├─ ruoyi-framework  框架层（shiro/拦截器/切面/数据源/配置）
├─ ruoyi-system     系统业务（domain/mapper/service → 用户/角色/菜单/部门）
├─ ruoyi-quartz     定时任务
├─ ruoyi-generator  代码生成器
└─ ruoyi-common     公共组件（annotation/config/core.domain/constant/enums/
                    exception/json/utils/xss）
```
层级：admin → 依赖 framework / system / quartz / generator；system 用 common；generator 的 `GenConstants` 竟放在 **ruoyi-common** 里——controller/service/mapper 是 standard java 分层。

### 2.5.2 生成器模块解剖（13 个 Java 类 + 15 个模板）

```
domain/GenTable.java / GenTableColumn.java     元数据结构
util/VelocityInitializer.java                   Velocity 引擎初始化
util/GenUtils.java                              元数据→类型/控件推断（核心逻辑）
util/VelocityUtils.java                         prepareContext / getTemplateList / getFileName
mapper/GenTableMapper.xml                       SQL：查表/查列（DBA→生成器）
service/IGenTableService.java                   生成主流程（syncTable→saveTable→代码生成）
controller/GenController.java                   UI 入口
resources/vm/java/*.vm                           6 个 java 模板
resources/vm/html/*.vm                          6 个 html 模板
resources/vm/sql/sql.vm + vm/xml/mapper.xml.vm   菜单/权限 SQL + mapper XML
```

### 2.5.3 生成器方法论：**命名约定推断行为**（GenUtils.initColumnField 实读）

按**列名后缀**自动推断字段行为：
```
*name        → 查询用 LIKE
*status      → html_type=radio（单选框）
*type / *sex → html_type=select（下拉框）
*file        → html_type=upload（上传）
*content     → html_type=summernote（富文本）
varchar>=500 / text → textarea
datetime            → DATE 类型 + datetime 控件
数字 len<=10 → Integer / len>10 → Long / 浮点 → BigDecimal（精确保留精度策略）
```
模板三选一（`tpl_category`）：`crud` / `tree` / `sub`（主子表），决定渲染哪些 vm。

### 2.5.4 生成文件名映射（getFileName 实读）

java 包路径 = packageName → serializer 为目录；生成类名命名规范：
```
domain/{}ClassName.java        mapper/{}ClassNameMapper.java
service/I{}ClassNameService.java       service/impl/{}ClassNameServiceImpl.java
controller/{}ClassNameController.java  resources/mapper/{module}/{ClassName}Mapper.xml
templates/{module}/{business}/{business}.html  (列表/树) + add/edit/view/tree.html
```
权限前缀 = `{moduleName}:{businessName}` → 每种操作再细分 `:list/:add/:edit/:remove/:export/:view`。

### 2.5.5 权限模型（SQL 实录：21 张表）

```
核心5表：sys_user、sys_role、sys_menu、sys_user_role、sys_role_menu
扩展：sys_dept、sys_post、sys_user_post、sys_role_dept、
      sys_dict_type/data、sys_config、sys_notice(+read)、sys_oper_log、
      sys_logininfor、sys_user_online、sys_job/log
生成器自持2表：gen_table、gen_table_column
```
`sys_user` 特色列：**del_flag 软删除**、**salt 字段**（密码=MD5(password+salt)）、status、login_ip/date。
`sys_menu` 即权限标识载体：permission 列 = `{module}:{business}:{action}`。
`sys_user_online` 用 sessionId 主键 + 序列化 session_data（**会话可重启恢复**——这对我们的 watchdog 有启示）。

### 2.5.6 分层模式（ISysUserService 实读）

Service 命名清一色命令式：`selectXxxList / selectXxxById / insertXxx / updateXxx / deleteXxxByIds / checkXxxUnique / importXxx / exportXxx`。
Controller extends BaseController，继承 `startPage/getDataTable/toAjax` 等命令式方法（非注解 AOP，直接继承）。

### 2.5.7 启动类

`RuoYiApplication` 本体极小，全部装配靠 Spring Boot 自动配置 + 子模块目录扫描。

---

## 三、Go 生态对照（先例）

| 框架 | 技术栈 | 核心能力 | 成熟度 |
|------|--------|---------|--------|
| **go-admin** (go-admin-team) | Gin + Vue3/React + GORM + Casbin + JWT | RBAC、代码生成、表单构建、定时任务 | 高，活跃，文档全 |
| **gin-vue-admin** (flipped-aurora) | Gin + Vue3 + Element + GORM + Casbin | AutoCode 1 分钟 CRUD、AI 辅助(MCP/skills)、动态路由 | 高，活跃 |
| **GoAdmin** (GoAdminGroup) | Gin + bootstrap-table | adm 全程管理（菜单 UI → 代码），类 laravel-admin | 中 |
| **sponge** | Gin + gRPC | 代码生成、一键生成 CRUD | 中 |
| **ruoyi-go 系**（gitee 多个移植版） | Gin + Vue | 若依功能 Go 化（结构大体完整，质量参差）| 中低 |

**共同模式**：Gin + GORM + Casbin + JWT + 代码生成器，这已是 Go 后台框架的事实标准组合。

---

## 四、映射到我们的 GO 框架（设计启示）

### 4.1 我们与若依的差异

| 维度 | 若依 | 我们 |
|------|------|------|
| 前端 | Vue + Element（前后端分离）| **HTMX + daisyUI**（SSR，零 npm）|
| 数据库 | MySQL + Redis | **SQLite**（嵌入式，零运维）|
| 定位 | 通用后台管理系统 | Loop 引擎的**工程底座** + 通用管理能力 |
| 核心差异点 | 代码生成器 + RBAC | 代码生成器 + RBAC + **AI 引擎入驻** |

### 4.2 借鉴点（要保留的若依/SpringBoot 能力）

1. **模块化结构**：admin / common / framework / system / generator / loop 分层
2. **自动配置思想**：Go 用 `init()` + 接口注册 or 显式组装，可选"条件装配"（配置开关决定加载哪套能力）
3. **RBAC**：User/Role/Menu/API 权限（SQLite 5 表）
4. **代码生成器**：SQLite 表元数据（`PRAGMA table_info`）→ `text/template` → 全套 CRUD + HTMX 页面
5. **监控/日志/统一异常**：slog + panic recovery 中间件 + `/healthz` + 运行诊断
6. **配置体系**：YAML + viper，profile 用 `-env=dev/prod`

### 4.3 我们自有的差异化（若依没有的）

| 能力 | 说明 |
|------|------|
| **Loop 引擎入驻** | 项目框架的最终用户是 AI loop，不是人点后台 |
| **Spec 驱动** | 代码生成器升级为"Spec → 生成"，而非"建表 → 生成" |
| **约束工程接口** | 框架层预留工具门禁/输出契约/上下文锁的对接位 |
| **单一二进制** | Go + 嵌入式 SQLite + HTMX 静态资源 `embed`，零依赖部署 |

### 4.4 技术栈定版（承接蓝图）

```
Web    ：Go 标准库 net/http（或 gin）+ templ + HTMX 2.x + daisyUI（CDN）+ SSE
数据   ：SQLite（现代cgo 驱动 或 modernc.org 纯 Go）
ORM    ：GORM（对齐 Go 生态惯例）或 sqlc（更显式，符合"反魔法"）
权限   ：JWT + 自研轻 RBAC（5 表，SQLite）或 Casbin
配置   ：viper + YAML，多环境 profile
日志   ：slog（标准库）
生成器 ：PRAGMA 元数据扫描 + text/template → CRUD + HTMX 页面
构建   ：Makefile
```

---

## 五、结论

- **"若依感"要保留**：模块分层、RBAC（5 表）、代码生成器（含"按列名推断行为"方法论）、监控日志、开箱即用。
- **生成器可复刻的核心 = 两件事**：① 元数据驱动（扫描 DB → GenTable/GenTableColumn）；② **命名约定推断**（列名后缀 → 类型/控件/查询方式）→ 模板渲染全套 CRUD。
- **"若依感"要替换**：Vue→HTMX、MySQL→SQLite（is_pk/is_increment/is_required 等元数据列在 SQLite 需用 PRAGMA 补齐）、纯后台→**AI Loop 底座**。
- **Go 生态有成熟先例**（go-admin / gin-vue-admin），不必自研轮子，**借鉴其 admin/system/generator 分层，差异化地加 loop 引擎层**。

---

## 六、从源码萃取的设计清单（供搭骨架用）

| # | 若依做法 | Go 骨架对应 |
|---|---------|------------|
| 1 | 6 模块 Maven 分层 | internal/{admin,common,framework,system,generator,loop} |
| 2 | GenConstants 放 common | 常量/元数据定义放 internal/common |
| 3 | GenTable/GenTableColumn | internal/generator/domain（元数据表） |
| 4 | PRAGMA 元数据 | SQLite `PRAGMA table_info()` + 人工建 gen_table 配置 |
| 5 | GenUtils 列名推断 | internal/generator/tools/column-rules.go |
| 6 | Velocity vm 模板 | internal/generator/templates/*.tmpl（text/template）|
| 7 | ShipShape controller/service/impl | standard 分层，命名对齐命令式 |
| 8 | sys_user 含 salt+del_flag | SQLite 建表照搬 |
| 9 | sys_user_online session 恢复 | watchdog 的会话持久化参考 |
| 10 | 权限前缀 module:business:action | 自研轻 RBAC，过滤中间件