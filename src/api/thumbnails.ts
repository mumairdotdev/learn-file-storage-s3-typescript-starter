import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError } from "./errors";
import { getInMemoryURL } from "./assets";


type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
   const formData = await req.formData();
   const imageFile = formData.get("thumbnail") as File | null;
   if (!imageFile) {
     throw new BadRequestError("No thumbnail file provided");
   }

   const MAX_UPLOAD_SIZE = 10 << 20; // 10MB
   if (imageFile.size > MAX_UPLOAD_SIZE) {
     throw new BadRequestError("Thumbnail file too large");
   }

   const imageType = imageFile.type;
   if (!imageType) {
      throw new BadRequestError("Thumbnail file has no type");
   }
   if (imageType !== "image/png" && imageType !== "image/jpeg") {
      throw new BadRequestError("Thumbnail file must be PNG or JPEG");
   }

    const fileData = await imageFile.arrayBuffer();
    if (!fileData) {
      throw new BadRequestError("Failed to read thumbnail file");
    }

    const video = getVideo(cfg.db, videoId);
    if (!video) {
      throw new NotFoundError("Couldn't find video");
    }
    if (video.userID !== userID) {
      throw new BadRequestError("You are not the owner of this video");
    }

    videoThumbnails.set(videoId, {
      data: fileData,
      mediaType: imageType,
    });

    // generate thumbnail url in format http://localhost:<port>/api/thumbnails/<videoID>
    const thumbnailUrl = getInMemoryURL(cfg, videoId);
    video.thumbnailURL = thumbnailUrl;

    updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
