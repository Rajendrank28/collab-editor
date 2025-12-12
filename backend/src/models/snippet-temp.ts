import { Schema, model, Document } from "mongoose";

export interface ISnippet extends Document {
  owner: string;
  title: string;
  html: string;
  css: string;
  js: string;
  isPublic: boolean;
  views: number;
}

const snippetSchema = new Schema<ISnippet>(
  {
    owner: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "Untitled Snippet",
    },
    html: {
      type: String,
      default: "",
    },
    css: {
      type: String,
      default: "",
    },
    js: {
      type: String,
      default: "",
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

const Snippet = model<ISnippet>("Snippet", snippetSchema);

export default Snippet;
