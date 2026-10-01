#!/usr/bin/env python3
"""Publish a ready Daily Thai release, or prepare its feed without credentials."""
import argparse, json, os, pathlib, urllib.request, xml.dom.minidom as DOM
from datetime import datetime, timezone
from email.utils import format_datetime

REPO = "justame/thai-class"
def api(path, method="GET", data=None):
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GH_TOKEN or GITHUB_TOKEN required for release publication")
    req = urllib.request.Request("https://api.github.com/repos/"+REPO+path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
                 "Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},
        method=method)
    with urllib.request.urlopen(req, timeout=40) as response:
        return json.load(response)

def check_asset(release, request):
    matches = [a for a in release["assets"] if a["name"] == request["assetName"]]
    if len(matches) != 1:
        raise ValueError("Expected exactly one audio asset")
    asset = matches[0]
    if asset["state"] != "uploaded" or asset["size"] != request["fileSizeBytes"]:
        raise ValueError("Incomplete or incorrect audio asset")
    if asset.get("digest") != "sha256:"+request["sha256"]:
        raise ValueError("Audio checksum does not match")
    if release["tag_name"] != "ep-"+str(request["number"]):
        raise ValueError("Episode tag does not match")
    return asset

def release_ready(request):
    release = api("/releases/"+str(request["releaseId"]))
    check_asset(release, request)
    if release["draft"]:
        release = api("/releases/"+str(release["id"]), "PATCH", {"draft":False})
    asset = check_asset(release, request)
    if release["draft"] or release["prerelease"]:
        raise ValueError("Release is not public")
    return asset["browser_download_url"]

def prepare(root, request, audio_url):
    expected = "https://github.com/"+REPO+"/releases/download/ep-"+str(request["number"])+"/"+request["assetName"]
    if audio_url != expected:
        raise ValueError("Unexpected published audio URL")
    episodes_path = root/"data/episodes.json"
    feed_path = root/"docs/feed.xml"
    episodes = json.loads(episodes_path.read_text())
    episode = {k:request[k] for k in ("number","title","description","pubDate","durationSeconds","fileSizeBytes")}
    episode["audioUrl"] = audio_url
    old = next((e for e in episodes if e["number"] == episode["number"]), None)
    if old is not None and old != episode:
        raise ValueError("Episode number already belongs to different metadata")
    if old is None:
        episodes.append(episode)
    doc = DOM.parseString(feed_path.read_text())
    channel = doc.getElementsByTagName("channel")[0]
    guid = "daily-thai-"+str(episode["number"])
    existing = [i for i in channel.getElementsByTagName("item")
                if i.getElementsByTagName("guid")[0].firstChild.data == guid]
    if len(existing) > 1:
        raise ValueError("Duplicate feed GUID")
    if existing:
        enclosure = existing[0].getElementsByTagName("enclosure")[0]
        if enclosure.getAttribute("url") != audio_url or enclosure.getAttribute("length") != str(episode["fileSizeBytes"]):
            raise ValueError("Existing feed entry conflicts")
    else:
        item = doc.createElement("item")
        def add(name, value, attrs=None):
            el = doc.createElement(name)
            if value is not None:
                el.appendChild(doc.createTextNode(str(value)))
            for key, val in (attrs or {}).items():
                el.setAttribute(key,str(val))
            item.appendChild(el)
        add("title",episode["title"])
        add("description",episode["description"])
        add("link","https://justame.github.io/thai-class#ep-"+str(episode["number"]))
        add("guid",guid,{"isPermaLink":"false"})
        add("dc:creator","Daily Thai")
        add("pubDate",format_datetime(datetime.fromisoformat(episode["pubDate"]).replace(tzinfo=timezone.utc),usegmt=True))
        add("enclosure",None,{"url":audio_url,"length":episode["fileSizeBytes"],"type":"audio/mpeg"})
        add("itunes:summary",episode["description"])
        add("itunes:explicit","false")
        seconds=round(episode["durationSeconds"])
        add("itunes:duration",f"{seconds//3600:02}:{seconds//60%60:02}:{seconds%60:02}")
        items=channel.getElementsByTagName("item")
        channel.insertBefore(item,items[0]) if items else channel.appendChild(item)
        build=channel.getElementsByTagName("lastBuildDate")[0]
        build.firstChild.data=format_datetime(datetime.now(timezone.utc),usegmt=True)
    episodes_path.write_text(json.dumps(episodes,ensure_ascii=False,indent=2)+"\n")
    feed_path.write_bytes(doc.toxml(encoding="UTF-8"))
    return episode

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request",default="data/publication-request.json")
    parser.add_argument("--mode",choices=["release","prepare","all"],default="all")
    parser.add_argument("--root",type=pathlib.Path,default=pathlib.Path("."))
    parser.add_argument("--audio-url")
    args=parser.parse_args()
    request=json.loads(pathlib.Path(args.request).read_text())
    url=release_ready(request) if args.mode != "prepare" else args.audio_url
    if args.mode != "release":
        prepare(args.root,request,url)
    print(json.dumps({"number":request["number"],"audioUrl":url},ensure_ascii=False))
if __name__ == "__main__":
    main()
