
var Q = require("q");
var GitFs = require("../fs");
var fs = require("q-io/fs");

Q.longStackSupport = true;

var repo = {};
repo.rootPath = fs.join(__dirname, "..", ".git");
require("git-node-fs/mixins/fs-db")(repo, repo.rootPath);
require('js-git/mixins/create-tree')(repo);
require('js-git/mixins/pack-ops')(repo);
require('js-git/mixins/walkers')(repo);
require('js-git/mixins/read-combiner')(repo);
require('js-git/mixins/formats')(repo);

var gitFs;
beforeEach(function () {
    gitFs = new GitFs(repo);
    return gitFs.load("refs/heads/master");
});

describe("readLink", function () {
    it("reads a symbolic link", function () {
        return gitFs.readLink("test/fixtures")
        .then(function (link) {
            expect(link).toBe("fixture")
        })
    });
    it("fails to read a non-link", function () {
        return gitFs.readLink("test/fixture")
        .then(function (link) {
            expect(false).toBe(true);
        }, function (error) {
            expect(error.message).toBe("Can't read non-symbolic-link at \"test/fixture\"")
            expect(error.code).toBe("EINVAL")
        })
    });
});

describe("canonical", function () {
    it("follows a symbolic link", function () {
        return gitFs.canonical("test/fixtures")
        .then(function (path) {
            expect(path).toBe("/test/fixture");
        });
    });
    it("follows through a symbolic link to a file", function () {
        return gitFs.canonical("test/fixtures/hello.txt")
        .then(function (path) {
            expect(path).toBe("/test/fixture/hello.txt");
        });
    });
    it("follows a symbolic link as far as it can then joins the remainder", function () {
        return gitFs.canonical("test/fixtures/defunct/zombie")
        .then(function (path) {
            expect(path).toBe("/test/fixture/defunct/zombie");
        });
    });
});

describe("list", function () {
    it("lists a directory", function () {
        return gitFs.list("test/fixture")
        .then(function (list) {
            expect(list).toEqual(["0123456789.txt", "hello.txt"])
        })
    });
    it("lists a symbolic link to a directory", function () {
        return gitFs.list("test/fixture")
        .then(function (list) {
            expect(list).toEqual(["0123456789.txt", "hello.txt"])
        })
    });
    it("fails to list a non existing directory", function () {
        return gitFs.list("test/fixture/defunct")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't list \"test/fixture/defunct\" because Can't find \"/test/fixture/defunct\"");
            expect(error.code).toBe("ENOENT");
        });
    });
    it("fails to list a non-directory", function () {
        return gitFs.list("test/fixture/hello.txt")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't list non-directory \"/test/fixture/hello.txt\"");
            expect(error.code).toBe("ENOTDIR");
        });
    });
});

describe("stat and statLink", function () {
    it("distinguish files, directories, and symbolic links", function () {
        return Q()
        .then(function () {
            return gitFs.stat("/test/fixture/hello.txt")
        })
        .then(function (stat) {
            expect(stat.isFile()).toBe(true);
            expect(stat.isDirectory()).toBe(false);
            expect(stat.isSymbolicLink()).toBe(false);
        })
        .then(function () {
            return gitFs.stat("/test/fixture")
        })
        .then(function (stat) {
            expect(stat.isFile()).toBe(false);
            expect(stat.isDirectory()).toBe(true);
            expect(stat.isSymbolicLink()).toBe(false);
        })
        .then(function () {
            return gitFs.statLink("/test/fixtures")
        })
        .then(function (stat) {
            expect(stat.isFile()).toBe(false);
            expect(stat.isDirectory()).toBe(false);
            expect(stat.isSymbolicLink()).toBe(true);
        })
        .then(function () {
            return gitFs.stat("/test/fixtures")
        })
        .then(function (stat) {
            expect(stat.isFile()).toBe(false);
            expect(stat.isDirectory()).toBe(true);
            expect(stat.isSymbolicLink()).toBe(false);
        })
    });
});

describe("read", function () {
    it("reads the whole content of a file", function () {
        return gitFs.read("/test/fixture/hello.txt")
        .then(function (content) {
            expect(content.toString()).toBe("Hello, World!\n");
        })
    });
    it("reads the whole content of a file in charset", function () {
        return gitFs.read("/test/fixture/hello.txt", {charset: "utf-8"})
        .then(function (content) {
            expect(content).toBe("Hello, World!\n");
        })
    });
    it("reads a partial range", function () {
        return gitFs.read("/test/fixture/0123456789.txt", {
            begin: 2,
            end: 4
        })
        .then(function (content) {
            expect(content.toString()).toBe("23");
        })
    });
});

describe("write", function () {
    it("writes a file", function () {
        return gitFs.write("/test/fixture/bye.txt", "Good bye, cruel World!\n")
        .then(function () {
            return [
                gitFs.list("/test/fixture"),
                gitFs.read("/test/fixture/bye.txt")
            ];
        })
        .spread(function (list, content) {
            expect(list).toEqual(["0123456789.txt", "bye.txt", "hello.txt"]);
            expect(content.toString()).toBe("Good bye, cruel World!\n");
        })
    });
    it("fails to overwrite a directory", function () {
        return gitFs.write("test/fixture", "Good bye, cruel World!\n")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't over-write directory \"/test/fixture\"");
            expect(error.code).toBe("EISDIR");
        })
    });
});

describe("remove", function () {
    it("removes a file", function () {
        return gitFs.remove("/test/fixture/hello.txt")
        .then(function () {
            return gitFs.list("/test/fixture");
        })
        .then(function (list) {
            expect(list).toEqual(["0123456789.txt"]);
        })
    });
    it("fails to remove a non-existant file", function () {
        return gitFs.remove("test/fixture/bye.txt")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't remove \"test/fixture/bye.txt\" because Can't find \"/test/fixture/bye.txt\"");
            expect(error.code).toBe("ENOENT");
        })
    });
    it("fails to remove a non-file", function () {
        return gitFs.remove("test/fixture")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't remove \"test/fixture\" because Can't remove non-file \"/test/fixture\"");
            expect(error.code).toBe("EINVAL");
        })
    });
});

describe("removeDirectory", function () {
    it("removes a directory", function () {
        return gitFs.makeDirectory("/test/fixture/directory")
        .then(function () {
            return gitFs.removeDirectory("/test/fixture/directory")
        })
        .then(function () {
            return [
                gitFs.list("/test/fixture"),
                gitFs.isDirectory("/test/fixture/directory")
            ]
        })
        .spread(function (parent, isDirectory) {
            expect(parent).toEqual(["0123456789.txt", "hello.txt"]);
            expect(isDirectory).toBe(false);
        })
    });
    it("fails to remove a non-existant directory", function () {
        return gitFs.removeDirectory("/test/fixture/directory")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't remove non-existant directory \"/test/fixture/directory\"");
            expect(error.code).toBe("ENOENT");
        })
    });
    it("fails to remove a non-directory", function () {
        return gitFs.removeDirectory("test/fixture/hello.txt")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't remove non-directory \"/test/fixture/hello.txt\"");
            expect(error.code).toBe("ENOTDIR");
        })
    });
    it("fails to remove a non-empty directory", function () {
        return gitFs.removeDirectory("test/fixture")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't remove non-empty directory \"/test/fixture\"");
            expect(error.code).toBe("ENOTEMPTY");
        })
    });
});

describe("removeTree", function () {
    it("removes a child tree", function () {
        return gitFs.removeTree("/test")
        .then(function () {
            return gitFs.list("/")
        })
        .then(function (list) {
            expect(list).not.toContain("test");
        });
    });
    it("removes an entire tree like a knife through butter", function () {
        return gitFs.removeTree("/")
        .then(function () {
            return gitFs.list("/")
        })
        .then(function (list) {
            expect(list).toEqual([]);
        });
    });
});

describe("makeDirectory", function () {
    it("makes a directory", function () {
        return gitFs.makeDirectory("/test/fixture/directory")
        .then(function () {
            return [
                gitFs.list("/test/fixture"),
                gitFs.list("/test/fixture/directory"),
                gitFs.isDirectory("/test/fixture/directory")
            ]
        })
        .spread(function (parent, child, isDirectory) {
            expect(parent).toEqual(["0123456789.txt", "directory", "hello.txt"]);
            expect(child).toEqual([]);
            expect(isDirectory).toBe(true);
        })
    });
    it("fails to overwrite a directory", function () {
        return gitFs.makeDirectory("/test/fixture")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't make directory over existing directory at \"/test/fixture\"");
            expect(error.code).toBe("EISDIR");
        });
    });
    it("fails to overwrite a file", function () {
        return gitFs.makeDirectory("/test/fixture/hello.txt")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't make directory over existing entry at \"/test/fixture/hello.txt\"");
            expect(error.code).toBe("EEXIST");
        });
    });
    it("fails to make directory in non-existent directory", function () {
        return gitFs.makeDirectory("test/fixture/defunct/zombie")
        .then(function () {
            expect(true).toBe(false);
        }, function (error) {
            expect(error.message).toBe("Can't make directory \"test/fixture/defunct/zombie\" because Can't find \"/test/fixture/defunct\"");
            expect(error.code).toBe("ENOENT");
        });
    });
});

describe("index management", function () {
    it("clears, saves, restores references", function () {
        return gitFs.clear()
        .then(function () {
            return gitFs.commit({
                message: "FIRST!",
                author: {name: "Kris Kowal", email: "kris@cixar.com"}
            })
        })
        .then(function () {
            return gitFs.saveAs("TEST");
        })
        .then(function () {
            return gitFs.load("refs/heads/master")
        })
        .then(function () {
            return gitFs.list("test")
        })
        .then(function (list) {
            expect(list).toContain("fixture");
            return gitFs.load("TEST")
        })
        .then(function () {
            return gitFs.list("");
        })
        .then(function (list) {
            expect(list).toEqual([]);
        })
    });
});

