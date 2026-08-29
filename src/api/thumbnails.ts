import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError } from "./errors";

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
   const file = formData.get("thumbnail") as File | null;
   if (!file) {
     throw new BadRequestError("No thumbnail file provided");
   }

   const MAX_UPLOAD_SIZE = 10 << 20; // 10MB
   if (file.size > MAX_UPLOAD_SIZE) {
     throw new BadRequestError("Thumbnail file too large");
   }

   const mediaType = file.type;
   if (!mediaType) {
      throw new BadRequestError("Thumbnail file has no type");
   }

    const fileData = await file.arrayBuffer();
    if (!fileData) {
      throw new BadRequestError("Failed to read thumbnail file");
    }

    const base64Data = Buffer.from(fileData).toString("base64");
    const base64DataURL = `data:${mediaType};base64,${base64Data}`;

    const video = getVideo(cfg.db, videoId);
    if (!video) {
      throw new NotFoundError("Couldn't find video");
    }
    if (video.userID !== userID) {
      throw new BadRequestError("You are not the owner of this video");
    }

    video.thumbnailURL = base64DataURL; // store the base64 data URL in the video object

    updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
